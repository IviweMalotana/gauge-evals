"""Run endpoints: trigger a run and read run/results."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Case, Dataset, Result, Run, Task
from app.schemas import (
    CompareCaseRow,
    CompareResponse,
    CompareSummary,
    ResultWithCase,
    RunDetail,
    RunSummary,
    TriggerRunRequest,
)
from app.services.runner import execute_run

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunSummary, status_code=201)
def trigger_run(body: TriggerRunRequest, db: Session = Depends(get_db)):
    task = db.get(Task, body.task_id)
    if task is None:
        raise HTTPException(404, "Task not found")

    dataset_id = body.dataset_id
    if dataset_id is None:
        dataset = db.scalar(
            select(Dataset).where(Dataset.task_id == task.id).order_by(Dataset.id)
        )
        if dataset is None:
            raise HTTPException(400, "Task has no dataset to run against")
        dataset_id = dataset.id
    elif db.get(Dataset, dataset_id) is None:
        raise HTTPException(404, "Dataset not found")

    settings = get_settings()
    model = body.model or settings.gauge_default_model
    scorers = body.scorers if body.scorers is not None else (task.default_scorers or [])
    label = body.label or f"Run on {model}"

    run = Run(
        task_id=task.id,
        dataset_id=dataset_id,
        label=label,
        model=model,
        params=body.params,
        scorers=scorers,
        pass_threshold=body.pass_threshold,
        notes=body.notes,
        status="queued",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Execute in a background thread so the request returns immediately and the
    # UI can poll progress.
    threading.Thread(target=execute_run, args=(run.id,), daemon=True).start()
    return run


@router.get("/{run_id}", response_model=RunDetail)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/{run_id}/results", response_model=list[ResultWithCase])
def list_run_results(run_id: int, db: Session = Depends(get_db)):
    if db.get(Run, run_id) is None:
        raise HTTPException(404, "Run not found")
    return list(db.scalars(select(Result).where(Result.run_id == run_id).order_by(Result.id)))


def _classify(base: Result | None, compare: Result | None) -> str:
    if base is None or compare is None:
        return "missing"
    if base.passed and not compare.passed:
        return "regressed"
    if compare.passed and not base.passed:
        return "improved"
    return "unchanged"


@router.get("/{base_id}/compare/{compare_id}", response_model=CompareResponse)
def compare_runs(base_id: int, compare_id: int, db: Session = Depends(get_db)):
    base = db.get(Run, base_id)
    compare = db.get(Run, compare_id)
    if base is None or compare is None:
        raise HTTPException(404, "Run not found")

    base_by_case = {r.case_id: r for r in base.results}
    compare_by_case = {r.case_id: r for r in compare.results}

    # Align over the union of cases, ordered by the case order in the dataset.
    case_ids = list(dict.fromkeys([*base_by_case, *compare_by_case]))
    cases = {
        c.id: c
        for c in db.scalars(select(Case).where(Case.id.in_(case_ids))) if case_ids
    }
    ordered = sorted(case_ids, key=lambda cid: (cases[cid].order_index if cid in cases else 0))

    rows: list[CompareCaseRow] = []
    improved = regressed = unchanged = 0
    for cid in ordered:
        b = base_by_case.get(cid)
        c = compare_by_case.get(cid)
        status = _classify(b, c)
        if status == "improved":
            improved += 1
        elif status == "regressed":
            regressed += 1
        elif status == "unchanged":
            unchanged += 1
        rows.append(
            CompareCaseRow(
                case=cases[cid],
                base=b,
                compare=c,
                score_delta=round((c.score if c else 0.0) - (b.score if b else 0.0), 4),
                latency_delta=(c.latency_ms if c else 0) - (b.latency_ms if b else 0),
                status=status,
            )
        )

    summary = CompareSummary(
        improved=improved,
        regressed=regressed,
        unchanged=unchanged,
        passed_delta=compare.passed - base.passed,
        score_delta=round(compare.avg_score - base.avg_score, 4),
        pass_rate_delta=round(compare.pass_rate - base.pass_rate, 4),
        cost_delta=round(compare.total_cost_usd - base.total_cost_usd, 6),
        latency_delta=round(compare.avg_latency_ms - base.avg_latency_ms, 1),
    )
    return CompareResponse(base=base, compare=compare, summary=summary, rows=rows)
