"""Scoring entrypoint used by the run engine.

Milestone 2 ships the run engine; the pluggable scorers (exact-match, contains,
regex, JSON-schema, LLM-as-judge) land in Milestone 3. Until then this returns
an empty score set so runs execute end-to-end and capture output/latency/cost.

`score_output` returns (scores, aggregate_score, passed) for one case's output.
"""

from __future__ import annotations

from app.models import Case


def score_output(
    *,
    case: Case,
    output: str,
    scorers: list[dict],
    pass_threshold: float,
    judge_executor=None,
) -> tuple[list[dict], float, bool]:
    # Placeholder until Milestone 3 implements the scorer registry.
    return [], 0.0, False
