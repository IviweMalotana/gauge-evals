"""Run engine: execute a task across every case in a dataset, score each output,
and persist results with denormalised run aggregates.

`execute_run` runs synchronously and is designed to be launched in a background
thread (see routers/runs.py). It updates `progress_done`/`progress_total` and
`status` as it goes so the UI can poll live progress.
"""

from __future__ import annotations

import json
import traceback
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Case, Result, Run
from app.services.executor import GaugeExecutionError, get_executor
from app.services.scoring import score_output


def _render_prompt(template: str, case_input: str) -> str:
    return template.replace("{{input}}", case_input)


def execute_run(run_id: int) -> None:
    """Execute a queued run to completion. Owns its own DB session (thread-safe)."""
    db: Session = SessionLocal()
    try:
        run = db.get(Run, run_id)
        if run is None:
            return
        task = run.task
        cases = list(
            db.scalars(
                select(Case).where(Case.dataset_id == run.dataset_id).order_by(Case.order_index)
            )
        )

        run.status = "running"
        run.started_at = datetime.now(timezone.utc)
        run.progress_total = len(cases)
        run.progress_done = 0
        db.commit()

        executor = get_executor()
        # A separate executor instance for the LLM-judge scorer (M3 uses it).
        judge_executor = executor

        run.is_mock = executor.is_mock
        results: list[Result] = []

        for case in cases:
            prompt = _render_prompt(task.prompt_template, case.input)
            try:
                call = executor.run(
                    system=task.system_prompt,
                    prompt=prompt,
                    model=run.model,
                    params=run.params or {},
                    hint=case.expected,
                )
                scores, agg, passed = score_output(
                    case=case,
                    output=call.output,
                    scorers=run.scorers or [],
                    pass_threshold=run.pass_threshold,
                    judge_executor=judge_executor,
                    judge_model=run.model,
                )
                res = Result(
                    run_id=run.id,
                    case_id=case.id,
                    output=call.output,
                    scores=scores,
                    score=round(agg, 4),
                    passed=passed,
                    latency_ms=call.latency_ms,
                    input_tokens=call.input_tokens,
                    output_tokens=call.output_tokens,
                    cost_usd=call.cost_usd,
                )
            except GaugeExecutionError as e:
                res = Result(
                    run_id=run.id,
                    case_id=case.id,
                    output=None,
                    scores=[],
                    score=0.0,
                    passed=False,
                    error=str(e),
                )
            db.add(res)
            results.append(res)
            run.progress_done += 1
            db.commit()

        _finalize(run, results)
        run.status = "completed"
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:  # noqa: BLE001 — never leave a run stuck in "running"
        db.rollback()
        run = db.get(Run, run_id)
        if run is not None:
            run.status = "failed"
            run.error = traceback.format_exc(limit=4)
            run.finished_at = datetime.now(timezone.utc)
            db.commit()
    finally:
        db.close()


def _finalize(run: Run, results: list[Result]) -> None:
    n = len(results) or 1
    scored = [r for r in results if r.error is None]
    run.total_cases = len(results)
    run.passed = sum(1 for r in results if r.passed)
    run.failed = len(results) - run.passed
    run.error_count = sum(1 for r in results if r.error)
    run.avg_score = round(sum(r.score for r in results) / n, 4)
    run.pass_rate = round(run.passed / n, 4)
    lat = [r.latency_ms for r in scored] or [0]
    run.avg_latency_ms = round(sum(lat) / len(lat), 1)
    run.total_input_tokens = sum(r.input_tokens for r in results)
    run.total_output_tokens = sum(r.output_tokens for r in results)
    run.total_cost_usd = round(sum(r.cost_usd for r in results), 6)
