"""Pluggable scorers and the scoring orchestrator used by the run engine.

Scorer types:
  - exact_match   : output equals expected (optionally JSON-normalised)
  - contains      : output contains a substring (expected, or configured text)
  - regex         : output matches a regular expression
  - json_schema   : output parses as JSON and validates against a JSON Schema
  - llm_judge     : a model grades the output against the rubric/expected and
                    returns a 0..1 score with its reasoning shown

Each scorer config is `{name, type, weight, config}` and produces a result dict
`{name, type, weight, score, passed, detail?|reasoning?}`. `score_output`
aggregates them into a weighted score and an overall pass/fail.

The LLM judge runs against the real Kimi (Moonshot) model when a key is configured;
in DEMO MODE it falls back to a deterministic heuristic judge so the rubric
scorer still produces a believable score and reasoning with zero setup.
"""

from __future__ import annotations

import difflib
import json
import re

from jsonschema import Draft202012Validator

from app.models import Case

# ── JSON helpers ───────────────────────────────────────────────────────────


def _try_load_json(text: str | None):
    if not text:
        return None, False
    try:
        return json.loads(text), True
    except (json.JSONDecodeError, TypeError):
        pass
    # Be lenient: pull the first {...} or [...] block out of prose / fences.
    match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1)), True
        except json.JSONDecodeError:
            return None, False
    return None, False


def _canonical(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False)


def _fmt(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, str):
        return f'"{v}"'
    return str(v)


# ── Individual scorers ─────────────────────────────────────────────────────


def _score_exact_match(output: str, case: Case, config: dict, **_) -> dict:
    expected = case.expected
    if expected is None:
        return {"score": 0.0, "passed": False, "detail": "No expected output defined."}
    if config.get("normalize_json"):
        out_obj, ok1 = _try_load_json(output)
        exp_obj, ok2 = _try_load_json(expected)
        if ok1 and ok2:
            match = _canonical(out_obj) == _canonical(exp_obj)
            return {
                "score": 1.0 if match else 0.0,
                "passed": match,
                "detail": "Exact match with expected JSON."
                if match
                else "Differs from expected JSON.",
            }
        # Fall through to string compare if either side isn't JSON.
    a, b = output or "", expected
    if config.get("trim", True):
        a, b = a.strip(), b.strip()
    if config.get("case_insensitive"):
        a, b = a.lower(), b.lower()
    match = a == b
    return {
        "score": 1.0 if match else 0.0,
        "passed": match,
        "detail": "Exact string match." if match else "Output does not match expected exactly.",
    }


def _score_contains(output: str, case: Case, config: dict, **_) -> dict:
    needle = config.get("text") or case.expected or ""
    hay = output or ""
    if config.get("case_insensitive"):
        needle, hay = needle.lower(), hay.lower()
    found = bool(needle) and needle in hay
    return {
        "score": 1.0 if found else 0.0,
        "passed": found,
        "detail": f"Output contains {_fmt(config.get('text') or case.expected)}."
        if found
        else f"Output does not contain {_fmt(config.get('text') or case.expected)}.",
    }


def _score_regex(output: str, case: Case, config: dict, **_) -> dict:
    pattern = config.get("pattern")
    if not pattern:
        return {"score": 0.0, "passed": False, "detail": "No regex pattern configured."}
    flags = re.IGNORECASE if config.get("case_insensitive") else 0
    try:
        matched = bool(re.search(pattern, output or "", flags))
    except re.error as e:
        return {"score": 0.0, "passed": False, "detail": f"Invalid regex: {e}"}
    return {
        "score": 1.0 if matched else 0.0,
        "passed": matched,
        "detail": f"Matched /{pattern}/." if matched else f"No match for /{pattern}/.",
    }


def _score_json_schema(output: str, case: Case, config: dict, **_) -> dict:
    schema = config.get("schema")
    if not schema:
        return {"score": 0.0, "passed": False, "detail": "No JSON schema configured."}
    obj, ok = _try_load_json(output)
    if not ok:
        return {"score": 0.0, "passed": False, "detail": "Response is not parseable JSON."}
    errors = sorted(Draft202012Validator(schema).iter_errors(obj), key=lambda e: e.path)
    if not errors:
        return {"score": 1.0, "passed": True, "detail": "Valid against the schema."}
    first = errors[0]
    loc = "/".join(str(p) for p in first.path) or "(root)"
    return {
        "score": 0.0,
        "passed": False,
        "detail": f"Schema violation at {loc}: {first.message}",
    }


# ── LLM-as-judge ───────────────────────────────────────────────────────────

_JUDGE_SYSTEM = (
    "You are a strict evaluation judge for an LLM eval harness. Grade the "
    "candidate output against the expected answer and the rubric. Be rigorous: "
    "award a high score only when the output is genuinely correct. Respond with "
    "ONLY a JSON object of the form "
    '{"score": <number between 0 and 1>, "reasoning": "<one or two sentences>"}.'
)


def _judge_prompt(case: Case, output: str) -> str:
    parts = [f"INPUT:\n{case.input}\n"]
    if case.expected:
        parts.append(f"EXPECTED OUTPUT:\n{case.expected}\n")
    if case.rubric:
        parts.append(f"RUBRIC:\n{case.rubric}\n")
    parts.append(f"CANDIDATE OUTPUT:\n{output}\n")
    parts.append('Return only the JSON: {"score": ..., "reasoning": ...}')
    return "\n".join(parts)


def _mock_judge(output: str, case: Case) -> tuple[float, str]:
    """Deterministic stand-in judge for DEMO MODE."""
    out_obj, ok1 = _try_load_json(output)
    exp_obj, ok2 = _try_load_json(case.expected)
    if ok1 and ok2 and isinstance(exp_obj, dict):
        keys = list(exp_obj.keys())
        if keys:
            mismatches = [k for k in keys if (out_obj or {}).get(k) != exp_obj[k]]
            frac = 1 - len(mismatches) / len(keys)
            score = round(min(1.0, 0.15 + 0.85 * frac), 3)
            if not mismatches:
                return score, "All fields match the expected output. Clean, ingestible result."
            shown = ", ".join(
                f"`{k}` should be {_fmt(exp_obj[k])} but got {_fmt((out_obj or {}).get(k))}"
                for k in mismatches[:3]
            )
            return score, f"{len(mismatches)} field(s) wrong: {shown}."
    if case.expected:
        ratio = difflib.SequenceMatcher(None, output or "", case.expected).ratio()
        return round(ratio, 3), f"Output is {round(ratio * 100)}% similar to the expected answer."
    return 0.5, "No expected output to compare against; graded neutrally."


def _score_llm_judge(
    output: str, case: Case, config: dict, judge_executor=None, judge_model: str | None = None
) -> dict:
    threshold = float(config.get("pass_threshold", 0.7))
    if judge_executor is not None and not getattr(judge_executor, "is_mock", True):
        model = config.get("model") or judge_model or "kimi-k2.6"
        try:
            call = judge_executor.run(
                system=_JUDGE_SYSTEM,
                prompt=_judge_prompt(case, output),
                model=model,
                params={"max_tokens": 300, "temperature": 0.0},
            )
            obj, ok = _try_load_json(call.output)
            if ok and isinstance(obj, dict) and "score" in obj:
                score = max(0.0, min(1.0, float(obj["score"])))
                reasoning = str(obj.get("reasoning", "")).strip() or "(no reasoning returned)"
            else:
                score, reasoning = 0.0, "Judge did not return a parseable score."
        except Exception as e:  # noqa: BLE001 — judge failure shouldn't crash the run
            score, reasoning = 0.0, f"Judge error: {e}"
    else:
        score, reasoning = _mock_judge(output, case)

    return {
        "score": round(score, 4),
        "passed": score >= threshold,
        "reasoning": reasoning,
    }


_REGISTRY = {
    "exact_match": _score_exact_match,
    "contains": _score_contains,
    "regex": _score_regex,
    "json_schema": _score_json_schema,
    "llm_judge": _score_llm_judge,
}


# ── Orchestrator ───────────────────────────────────────────────────────────


def score_output(
    *,
    case: Case,
    output: str,
    scorers: list[dict],
    pass_threshold: float,
    judge_executor=None,
    judge_model: str | None = None,
) -> tuple[list[dict], float, bool]:
    """Run every configured scorer and aggregate into (results, score, passed)."""
    results: list[dict] = []
    for cfg in scorers or []:
        stype = cfg.get("type")
        fn = _REGISTRY.get(stype)
        weight = float(cfg.get("weight", 1.0))
        if fn is None:
            results.append(
                {
                    "name": cfg.get("name", stype or "unknown"),
                    "type": stype,
                    "weight": weight,
                    "score": 0.0,
                    "passed": False,
                    "detail": f"Unknown scorer type: {stype!r}",
                }
            )
            continue
        outcome = fn(
            output,
            case,
            cfg.get("config", {}),
            judge_executor=judge_executor,
            judge_model=judge_model,
        )
        results.append(
            {
                "name": cfg.get("name", stype),
                "type": stype,
                "weight": weight,
                **outcome,
            }
        )

    total_weight = sum(r["weight"] for r in results) or 1.0
    aggregate = sum(r["weight"] * r["score"] for r in results) / total_weight
    passed = bool(results) and aggregate >= pass_threshold
    return results, aggregate, passed
