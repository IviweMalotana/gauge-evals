"""Verify the live Kimi (Moonshot) path end to end.

Run after putting your MOONSHOT_API_KEY in .env. Hits the real model once with
a tiny prompt, prints the response + usage + computed cost, then runs ONE case
through the full Gauge stack (executor + scorers) so we know not just that the
key works but that scoring lands too.

    cd api && uv run python scripts/smoke_kimi.py

Exits 0 on success, non-zero on any failure with the underlying error message.
"""

from __future__ import annotations

import json
import sys

from app.config import get_settings
from app.demo_dataset import LEAD_SCHEMA, PROMPT_TEMPLATE, RUBRIC, SYSTEM_PROMPT
from app.models import Case
from app.services.executor import KimiExecutor, GaugeExecutionError
from app.services.scoring import score_output


def fail(msg: str) -> None:
    print(f"\n❌ {msg}")
    sys.exit(1)


def main() -> None:
    settings = get_settings()
    if not settings.has_model_key:
        fail(
            "MOONSHOT_API_KEY is not set. Put it in .env (see .env.example) "
            "or export it before running."
        )

    print(f"→ base url : {settings.moonshot_base_url}")
    print(f"→ model    : {settings.gauge_default_model}")
    print()

    executor = KimiExecutor(settings.moonshot_api_key, settings.moonshot_base_url)

    # 1. Cheapest possible probe — does the key + URL + model work at all?
    print("[1/2] Probing the model with a one-token reply…")
    try:
        probe = executor.run(
            system="Reply with exactly the single word OK and nothing else.",
            prompt="Reply.",
            model=settings.gauge_default_model,
            params={"max_tokens": 8, "temperature": 0.0},
        )
    except GaugeExecutionError as e:
        fail(f"Probe failed: {e}")

    print(f"    reply     : {probe.output!r}")
    print(f"    tokens    : {probe.input_tokens} in / {probe.output_tokens} out")
    print(f"    latency   : {probe.latency_ms} ms")
    print(f"    cost      : ${probe.cost_usd:.6f}")
    print()

    # 2. Real Gauge case end-to-end (the demo dataset's first lead).
    print("[2/2] Running one real Gauge case (lead extraction + scoring)…")
    expected = {
        "name": "Marcus Lee",
        "company": "Northwind Labs",
        "email": "marcus@northwindlabs.io",
        "budget_usd": 40000,
        "intent": "demo",
    }
    case = Case(
        id=1,
        dataset_id=1,
        name="smoke",
        input=(
            "hey there — saw your booth at SaaStr. I'm Marcus Lee, run growth at "
            "Northwind Labs. we're evaluating tooling for Q3, prob looking to spend "
            "around 40k. can someone walk us through a demo next week? "
            "marcus@northwindlabs.io"
        ),
        expected=json.dumps(expected, indent=2),
        rubric=RUBRIC,
    )

    try:
        call = executor.run(
            system=SYSTEM_PROMPT,
            prompt=PROMPT_TEMPLATE.replace("{{input}}", case.input),
            model=settings.gauge_default_model,
            params={"max_tokens": 400, "temperature": 0.0},
        )
    except GaugeExecutionError as e:
        fail(f"Real case execution failed: {e}")

    scorers = [
        {"name": "JSON schema", "type": "json_schema", "weight": 0.25,
         "config": {"schema": LEAD_SCHEMA}},
        {"name": "Exact match", "type": "exact_match", "weight": 0.25,
         "config": {"normalize_json": True}},
        {"name": "LLM judge", "type": "llm_judge", "weight": 0.50,
         "config": {"pass_threshold": 0.7}},
    ]
    scores, agg, passed = score_output(
        case=case,
        output=call.output,
        scorers=scorers,
        pass_threshold=0.7,
        judge_executor=executor,
        judge_model=settings.gauge_default_model,
    )

    print(f"    output    : {call.output[:120]}{'…' if len(call.output) > 120 else ''}")
    for s in scores:
        detail = s.get("reasoning") or s.get("detail") or ""
        print(f"      {s['name']:<12} score={s['score']:.2f}  pass={s['passed']}  :: {detail[:80]}")
    print(f"    overall   : score={agg:.2f}  passed={passed}  cost=${call.cost_usd:.6f}")
    print()
    print("✓ Live Kimi path is working — `make api` then trigger a run from the UI.")


if __name__ == "__main__":
    main()
