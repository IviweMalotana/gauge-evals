"""Dataset and case endpoints (dataset editor backend)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Case, Dataset
from app.schemas import CaseCreate, CaseOut, CaseUpdate, DatasetWithCases

router = APIRouter(tags=["datasets"])


@router.get("/datasets/{dataset_id}", response_model=DatasetWithCases)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(404, "Dataset not found")
    return ds


@router.post("/datasets/{dataset_id}/cases", response_model=CaseOut, status_code=201)
def create_case(dataset_id: int, body: CaseCreate, db: Session = Depends(get_db)):
    if db.get(Dataset, dataset_id) is None:
        raise HTTPException(404, "Dataset not found")
    order = body.order_index
    if order is None:
        max_idx = db.scalar(
            select(func.max(Case.order_index)).where(Case.dataset_id == dataset_id)
        )
        order = (max_idx + 1) if max_idx is not None else 0
    case = Case(
        dataset_id=dataset_id,
        name=body.name,
        input=body.input,
        expected=body.expected,
        rubric=body.rubric,
        order_index=order,
        meta={},
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.patch("/cases/{case_id}", response_model=CaseOut)
def update_case(case_id: int, body: CaseUpdate, db: Session = Depends(get_db)):
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(case, field, value)
    db.commit()
    db.refresh(case)
    return case


@router.delete("/cases/{case_id}", status_code=204)
def delete_case(case_id: int, db: Session = Depends(get_db)):
    case = db.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    db.delete(case)
    db.commit()
