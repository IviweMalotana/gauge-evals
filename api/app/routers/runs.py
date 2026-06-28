"""Run endpoints: trigger a run and read run/results."""

from __future__ import annotations

import threading

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Dataset, Result, Run, Task
from app.schemas import ResultWithCase, RunDetail, RunSummary, TriggerRunRequest
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
