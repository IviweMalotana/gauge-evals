"""Seed the demo task, dataset, and four historical runs.

Idempotent: re-running drops and recreates the demo task (by slug) so the
dataset and run history are always in a known state. Outputs and scores for the
historical runs are synthesised deterministically from the per-case ``outcomes``
in ``demo_dataset.py`` — no model calls, so the demo is fully populated with
zero setup.

    uv run python -m app.seed
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app import demo_dataset as dd
from app.db import SessionLocal
from app.models import Case, Dataset, Result, Run, Task
from app.services.pricing import cost_usd

INTENT_NEIGHBOR = {
    "demo": "pricing",
    "pricing": "other",
    "support": "other",
    "partnership": "pricing",
    "other": "support",
}

# Hand-authored wrong outputs for the cases that ever fail hard, so the failure
# modes read like real model mistakes.
WRONG_OVERRIDES: dict[int, str] = {
    # Invalid JSON: model wrote the budget as a literal "120K".
    4: (
        '{"name": "Sofia Marchetti", "company": "Quanta Logistics", '
        '"email": "sofia.m@quantalogistics.com", "budget_usd": 120K, "intent": "demo"}'
    ),
    # Valid JSON but several fields wrong: hallucinated "Inc", dropped the
    # plus-address, misclassified intent.
    11: json.dumps(
        {
            "name": "Niamh Byrne",
            "company": "Loopback Inc",
            "email": "niamh@loopback.dev",
            "budget_usd": None,
            "intent": "other",
        }
    ),
}


def canonical(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False)


def approx_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


# ── output synthesis ────────────────────────────────────────────────────


def make_minor(expected: dict) -> tuple[str, str]:
    """Return (output_json, short description of the single introduced error)."""
    out = dict(expected)
    if expected["budget_usd"] is not None:
        out["budget_usd"] = None
        desc = f"missed the stated budget (expected {expected['budget_usd']}, returned null)"
    elif expected["company"] is not None:
        out["company"] = None
        desc = f"dropped the company (expected {expected['company']!r}, returned null)"
    else:
        wrong_intent = INTENT_NEIGHBOR[expected["intent"]]
        out["intent"] = wrong_intent
        desc = f"misclassified intent as {wrong_intent!r} (expected {expected['intent']!r})"
    return json.dumps(out), desc


def make_wrong(idx: int, expected: dict) -> str:
    if idx in WRONG_OVERRIDES:
        return WRONG_OVERRIDES[idx]
    # Generic fallback: valid JSON, several fields corrupted.
    out = dict(expected)
    out["company"] = (expected["company"] or "Acme") + " Inc"
    out["intent"] = INTENT_NEIGHBOR[expected["intent"]]
    return json.dumps(out)


# ── inline scorers (the seed's historical truth; M3 formalises these) ────


def score_json_schema(output: str) -> tuple[float, bool, str]:
    try:
        obj = json.loads(output)
    except json.JSONDecodeError:
        return 0.0, False, "Response is not parseable JSON."
    required = set(dd.LEAD_SCHEMA["required"])
    if not isinstance(obj, dict) or not required.issubset(obj):
        return 0.0, False, "JSON is missing required keys."
    if obj.get("intent") not in dd.LEAD_SCHEMA["properties"]["intent"]["enum"]:
        return 0.0, False, f"intent {obj.get('intent')!r} is not an allowed value."
    return 1.0, True, "Valid against the lead schema."


def score_exact_match(output: str, expected: dict) -> tuple[float, bool, str]:
    try:
        obj = json.loads(output)
    except json.JSONDecodeError:
        return 0.0, False, "Could not parse output to compare."
    if canonical(obj) == canonical(expected):
        return 1.0, True, "Exact match with expected JSON."
    return 0.0, False, "Differs from expected JSON."


def field_mismatches(output: str, expected: dict) -> list[tuple[str, object, object]]:
    try:
        obj = json.loads(output)
    except json.JSONDecodeError:
        return [("(parse)", canonical(expected), "unparseable")]
    out = []
    for k in expected:
        if obj.get(k) != expected[k]:
            out.append((k, expected[k], obj.get(k)))
    return out


def _fmt(v: object) -> str:
    if v is None:
        return "null"
    if isinstance(v, str):
        return f'"{v}"'
    return str(v)


def judge(outcome: str, expected: dict, output: str, json_valid: bool, rng: random.Random):
    """Synthesise an LLM-as-judge score + reasoning consistent with the outcome."""
    mism = field_mismatches(output, expected)
    if outcome == "correct":
        score = round(0.90 + rng.random() * 0.09, 3)
        reasoning = (
            "All five fields match the expected lead — name, company, email, "
            "budget, and intent are correct. Clean, ingestible JSON."
        )
    elif outcome == "minor":
        score = round(0.45 + rng.random() * 0.22, 3)
        if mism:
            f, exp, got = mism[0]
            reasoning = (
                f"Mostly right, but `{f}` is wrong: expected {_fmt(exp)}, got "
                f"{_fmt(got)}. A single bad field still produces a flawed CRM record."
            )
        else:
            reasoning = "A field deviates from the expected lead."
    else:  # wrong
        if not json_valid:
            score = round(0.05 + rng.random() * 0.12, 3)
            reasoning = (
                "The response is not valid JSON — it contains a malformed value, so "
                "the lead cannot be parsed or ingested downstream. Hard fail."
            )
        else:
            score = round(0.20 + rng.random() * 0.15, 3)
            parts = ", ".join(f"`{f}` should be {_fmt(exp)} not {_fmt(got)}" for f, exp, got in mism)
            reasoning = f"Multiple fields are wrong: {parts}. This would create a bad record."
    return score, (score >= 0.7), reasoning


# ── per-result synthesis ────────────────────────────────────────────────


def build_result(idx: int, case: Case, expected: dict, outcome: str, run_cfg: dict, rng):
    if outcome == "correct":
        output = json.dumps(expected)
    elif outcome == "minor":
        output, _ = make_minor(expected)
    else:
        output = make_wrong(idx, expected)

    js_score, js_pass, js_detail = score_json_schema(output)
    em_score, em_pass, em_detail = score_exact_match(output, expected)
    j_score, j_pass, j_reason = judge(outcome, expected, output, js_pass, rng)

    scores = [
        {"name": "JSON schema", "type": "json_schema", "weight": 0.25,
         "score": js_score, "passed": js_pass, "detail": js_detail},
        {"name": "Exact match", "type": "exact_match", "weight": 0.25,
         "score": em_score, "passed": em_pass, "detail": em_detail},
        {"name": "LLM judge", "type": "llm_judge", "weight": 0.50,
         "score": j_score, "passed": j_pass, "reasoning": j_reason},
    ]
    agg = sum(s["weight"] * s["score"] for s in scores)
    passed = agg >= run_cfg.get("pass_threshold", 0.7)

    # Token / latency / cost synthesis.
    rendered = dd.SYSTEM_PROMPT + dd.PROMPT_TEMPLATE.replace("{{input}}", case.input)
    in_tok = approx_tokens(rendered)
    out_tok = max(20, approx_tokens(output))
    model = run_cfg["model"]
    if "haiku" in model:
        latency = int(480 + rng.random() * 360)
    else:
        latency = int(1050 + rng.random() * 650)
    cost = cost_usd(model, in_tok, out_tok)

    return Result(
        case_id=case.id,
        output=output,
        scores=scores,
        score=round(agg, 4),
        passed=passed,
        latency_ms=latency,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cost_usd=cost,
    )


def seed() -> None:
    db = SessionLocal()
    try:
        # Idempotent reset of the demo task.
        existing = db.scalar(select(Task).where(Task.slug == dd.TASK["slug"]))
        if existing:
            db.delete(existing)
            db.flush()

        task = Task(
            slug=dd.TASK["slug"],
            name=dd.TASK["name"],
            description=dd.TASK["description"],
            system_prompt=dd.TASK["system_prompt"],
            prompt_template=dd.TASK["prompt_template"],
            input_label=dd.TASK["input_label"],
            output_label=dd.TASK["output_label"],
            default_scorers=dd.SCORERS,
        )
        db.add(task)
        db.flush()

        dataset = Dataset(
            task_id=task.id,
            name="Inbound messages — v1",
            description="12 hand-written messy inbound messages with expected lead JSON.",
        )
        db.add(dataset)
        db.flush()

        cases: list[Case] = []
        for i, c in enumerate(dd.CASES):
            case = Case(
                dataset_id=dataset.id,
                name=c["name"],
                input=c["input"],
                expected=json.dumps(c["expected"], indent=2),
                rubric=dd.RUBRIC,
                order_index=i,
                meta={},
            )
            db.add(case)
            cases.append(case)
        db.flush()

        now = datetime.now(timezone.utc)
        for r_idx, run_cfg in enumerate(dd.RUNS):
            created = now - timedelta(days=run_cfg["days_ago"], hours=2)
            run = Run(
                task_id=task.id,
                dataset_id=dataset.id,
                label=run_cfg["label"],
                model=run_cfg["model"],
                params=run_cfg["params"],
                scorers=dd.SCORERS,
                pass_threshold=0.7,
                notes=run_cfg["notes"],
                status="completed",
                is_mock=True,
                created_at=created,
                started_at=created,
                progress_total=len(cases),
                progress_done=len(cases),
            )
            db.add(run)
            db.flush()

            results: list[Result] = []
            for i, case in enumerate(cases):
                rng = random.Random(1000 * r_idx + i)
                outcome = run_cfg["outcomes"][i]
                res = build_result(i, case, dd.CASES[i]["expected"], outcome, run_cfg, rng)
                res.run_id = run.id
                db.add(res)
                results.append(res)

            # Aggregates.
            n = len(results)
            run.total_cases = n
            run.passed = sum(1 for r in results if r.passed)
            run.failed = n - run.passed
            run.error_count = sum(1 for r in results if r.error)
            run.avg_score = round(sum(r.score for r in results) / n, 4)
            run.pass_rate = round(run.passed / n, 4)
            run.avg_latency_ms = round(sum(r.latency_ms for r in results) / n, 1)
            run.total_input_tokens = sum(r.input_tokens for r in results)
            run.total_output_tokens = sum(r.output_tokens for r in results)
            run.total_cost_usd = round(sum(r.cost_usd for r in results), 6)
            total_ms = sum(r.latency_ms for r in results)
            run.finished_at = created + timedelta(milliseconds=total_ms)
            db.add(run)

        db.commit()

        # Summary.
        print(f"✓ Seeded task '{task.name}' (slug: {task.slug})")
        print(f"  dataset: {dataset.name} — {len(cases)} cases")
        runs = db.scalars(select(Run).where(Run.task_id == task.id).order_by(Run.created_at)).all()
        for run in runs:
            print(
                f"  run #{run.id} {run.label:<32} {run.model:<26} "
                f"pass {run.passed}/{run.total_cases}  avg {run.avg_score:.2f}  "
                f"${run.total_cost_usd:.4f}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
