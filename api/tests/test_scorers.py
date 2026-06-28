"""Unit tests for the scorer registry."""

from __future__ import annotations

import json

from app.models import Case
from app.services.scoring import score_output


def make_case(expected: str | None = None, rubric: str | None = None, input: str = "in") -> Case:
    return Case(id=1, dataset_id=1, name="c", input=input, expected=expected, rubric=rubric)


def test_exact_match_json_normalized_ignores_key_order():
    case = make_case(expected='{"a": 1, "b": 2}')
    out = '{"b": 2, "a": 1}'
    scorers = [{"name": "Exact", "type": "exact_match", "weight": 1, "config": {"normalize_json": True}}]
    results, agg, passed = score_output(case=case, output=out, scorers=scorers, pass_threshold=0.7)
    assert results[0]["passed"] is True
    assert agg == 1.0 and passed


def test_exact_match_detects_difference():
    case = make_case(expected='{"a": 1}')
    results, agg, _ = score_output(
        case=case,
        output='{"a": 2}',
        scorers=[{"type": "exact_match", "weight": 1, "config": {"normalize_json": True}}],
        pass_threshold=0.7,
    )
    assert results[0]["passed"] is False and agg == 0.0


def test_contains():
    case = make_case()
    scorers = [{"type": "contains", "weight": 1, "config": {"text": "hello", "case_insensitive": True}}]
    r, _, _ = score_output(case=case, output="Well HELLO there", scorers=scorers, pass_threshold=0.7)
    assert r[0]["passed"] is True


def test_regex():
    case = make_case()
    scorers = [{"type": "regex", "weight": 1, "config": {"pattern": r"\d{3}-\d{4}"}}]
    r, _, _ = score_output(case=case, output="call 555-1234", scorers=scorers, pass_threshold=0.7)
    assert r[0]["passed"] is True
    r2, _, _ = score_output(case=case, output="no number", scorers=scorers, pass_threshold=0.7)
    assert r2[0]["passed"] is False


def test_json_schema_valid_and_invalid():
    schema = {
        "type": "object",
        "properties": {"n": {"type": "integer"}},
        "required": ["n"],
        "additionalProperties": False,
    }
    case = make_case()
    scorers = [{"type": "json_schema", "weight": 1, "config": {"schema": schema}}]
    ok, _, _ = score_output(case=case, output='{"n": 5}', scorers=scorers, pass_threshold=0.7)
    assert ok[0]["passed"] is True
    bad, _, _ = score_output(case=case, output='{"n": "x"}', scorers=scorers, pass_threshold=0.7)
    assert bad[0]["passed"] is False
    notjson, _, _ = score_output(case=case, output="not json", scorers=scorers, pass_threshold=0.7)
    assert notjson[0]["passed"] is False


def test_json_schema_extracts_from_prose():
    schema = {"type": "object", "properties": {"n": {"type": "integer"}}, "required": ["n"]}
    case = make_case()
    scorers = [{"type": "json_schema", "weight": 1, "config": {"schema": schema}}]
    r, _, _ = score_output(
        case=case, output='Here you go: {"n": 7}. Hope that helps!', scorers=scorers, pass_threshold=0.7
    )
    assert r[0]["passed"] is True


def test_mock_judge_rewards_correct_and_penalizes_wrong():
    expected = json.dumps({"name": "Marcus", "company": "Acme", "intent": "demo"})
    case = make_case(expected=expected, rubric="Match all fields.")
    scorers = [{"type": "llm_judge", "weight": 1, "config": {"pass_threshold": 0.7}}]
    good, agg_good, _ = score_output(
        case=case, output=expected, scorers=scorers, pass_threshold=0.7
    )
    assert good[0]["passed"] is True and "reasoning" in good[0]
    wrong = json.dumps({"name": "X", "company": "Y", "intent": "support"})
    bad, agg_bad, _ = score_output(case=case, output=wrong, scorers=scorers, pass_threshold=0.7)
    assert bad[0]["passed"] is False
    assert agg_good > agg_bad


def test_weighted_aggregation_and_threshold():
    case = make_case(expected='{"a": 1}', rubric="x")
    scorers = [
        {"type": "json_schema", "weight": 0.25,
         "config": {"schema": {"type": "object", "properties": {"a": {"type": "integer"}}, "required": ["a"]}}},
        {"type": "exact_match", "weight": 0.25, "config": {"normalize_json": True}},
        {"type": "llm_judge", "weight": 0.5, "config": {"pass_threshold": 0.7}},
    ]
    results, agg, passed = score_output(case=case, output='{"a": 1}', scorers=scorers, pass_threshold=0.7)
    assert len(results) == 3
    assert passed is True and agg > 0.7
