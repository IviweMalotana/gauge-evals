"""Pydantic schemas for API request/response bodies."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Cases ────────────────────────────────────────────────────────────────


class CaseOut(ORMModel):
    id: int
    dataset_id: int
    name: str
    input: str
    expected: str | None
    rubric: str | None
    order_index: int


class CaseCreate(BaseModel):
    name: str
    input: str
    expected: str | None = None
    rubric: str | None = None
    order_index: int | None = None


class CaseUpdate(BaseModel):
    name: str | None = None
    input: str | None = None
    expected: str | None = None
    rubric: str | None = None
    order_index: int | None = None


# ── Datasets ─────────────────────────────────────────────────────────────


class DatasetOut(ORMModel):
    id: int
    task_id: int
    name: str
    description: str
    created_at: datetime


class DatasetWithCases(DatasetOut):
    cases: list[CaseOut]


# ── Tasks ────────────────────────────────────────────────────────────────


class TaskOut(ORMModel):
    id: int
    slug: str
    name: str
    description: str
    input_label: str
    output_label: str
    created_at: datetime


class TaskDetail(TaskOut):
    system_prompt: str
    prompt_template: str
    default_scorers: list
    datasets: list[DatasetOut]


# ── Runs & results ───────────────────────────────────────────────────────


class RunSummary(ORMModel):
    id: int
    task_id: int
    dataset_id: int
    label: str
    model: str
    params: dict
    status: str
    is_mock: bool
    pass_threshold: float
    progress_done: int
    progress_total: int
    total_cases: int
    passed: int
    failed: int
    error_count: int
    avg_score: float
    pass_rate: float
    avg_latency_ms: float
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    notes: str
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ResultOut(ORMModel):
    id: int
    case_id: int
    output: str | None
    scores: list
    score: float
    passed: bool
    latency_ms: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
    error: str | None


class ResultWithCase(ResultOut):
    case: CaseOut


class RunDetail(RunSummary):
    scorers: list
    results: list[ResultWithCase]


class TriggerRunRequest(BaseModel):
    task_id: int
    dataset_id: int | None = None
    model: str | None = None
    label: str | None = None
    notes: str = ""
    params: dict = Field(default_factory=lambda: {"temperature": 0.0, "max_tokens": 400})
    scorers: list | None = None
    pass_threshold: float = 0.7
