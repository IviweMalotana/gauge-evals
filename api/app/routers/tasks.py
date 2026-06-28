"""Task endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Run, Task
from app.schemas import RunSummary, TaskDetail, TaskOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return list(db.scalars(select(Task).order_by(Task.created_at)))


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(404, "Task not found")
    return task


@router.get("/{task_id}/runs", response_model=list[RunSummary])
def list_task_runs(task_id: int, db: Session = Depends(get_db)):
    if db.get(Task, task_id) is None:
        raise HTTPException(404, "Task not found")
    return list(
        db.scalars(
            select(Run).where(Run.task_id == task_id).order_by(Run.created_at.desc())
        )
    )
