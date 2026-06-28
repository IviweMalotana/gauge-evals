"""ORM models for Gauge.

Schema:
  tasks      — a prompt/system under test
  datasets   — a named collection of cases belonging to a task
  cases      — a single test case (input + expected output and/or rubric)
  runs       — one execution of a task over a dataset (model + params + scorers)
  results    — per-case output, scores, latency, tokens, and cost for a run

Run aggregates (pass rate, avg score, cost, latency) are denormalised onto the
`runs` row at completion so the dashboard and trend views stay cheap to query.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")

    # The system under test.
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    # User-message template; `{{input}}` is replaced with each case's input.
    prompt_template: Mapped[str] = mapped_column(Text, default="{{input}}")

    # UI labels for the input/output columns.
    input_label: Mapped[str] = mapped_column(String(60), default="Input")
    output_label: Mapped[str] = mapped_column(String(60), default="Output")

    # Default scorer configuration applied when a run does not override it.
    default_scorers: Mapped[list] = mapped_column(JSONB, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    datasets: Mapped[list[Dataset]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="Dataset.id"
    )
    runs: Mapped[list[Run]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="Run.created_at"
    )


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped[Task] = relationship(back_populates="datasets")
    cases: Mapped[list[Case]] = relationship(
        back_populates="dataset", cascade="all, delete-orphan", order_by="Case.order_index"
    )


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    input: Mapped[str] = mapped_column(Text)
    # Expected output (e.g. canonical JSON) — optional when grading by rubric only.
    expected: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Grading rubric for the LLM-as-judge scorer — optional.
    rubric: Mapped[str | None] = mapped_column(Text, nullable=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    dataset: Mapped[Dataset] = relationship(back_populates="cases")
    results: Mapped[list[Result]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[int] = mapped_column(
        ForeignKey("datasets.id", ondelete="CASCADE"), index=True
    )

    label: Mapped[str] = mapped_column(String(200), default="")
    model: Mapped[str] = mapped_column(String(120))
    params: Mapped[dict] = mapped_column(JSONB, default=dict)
    scorers: Mapped[list] = mapped_column(JSONB, default=list)
    pass_threshold: Mapped[float] = mapped_column(Float, default=0.7)
    notes: Mapped[str] = mapped_column(Text, default="")

    # queued | running | completed | failed
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # Whether outputs were produced by the real model or the deterministic mock.
    is_mock: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Live progress (so the trigger-run view can poll).
    progress_done: Mapped[int] = mapped_column(Integer, default=0)
    progress_total: Mapped[int] = mapped_column(Integer, default=0)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Denormalised aggregates (computed at completion).
    total_cases: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0)
    pass_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    total_input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)

    task: Mapped[Task] = relationship(back_populates="runs")
    dataset: Mapped[Dataset] = relationship()
    results: Mapped[list[Result]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="Result.id"
    )


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (UniqueConstraint("run_id", "case_id", name="uq_result_run_case"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)

    output: Mapped[str | None] = mapped_column(Text, nullable=True)
    # List of per-scorer results: {name, type, score, passed, weight, detail, reasoning}.
    scores: Mapped[list] = mapped_column(JSONB, default=list)
    score: Mapped[float] = mapped_column(Float, default=0.0)  # weighted aggregate, 0..1
    passed: Mapped[bool] = mapped_column(Boolean, default=False)

    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    run: Mapped[Run] = relationship(back_populates="results")
    case: Mapped[Case] = relationship(back_populates="results")
