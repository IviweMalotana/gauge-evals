"""Task executors — turn a (system, prompt) into model output + usage metrics.

Two implementations:
  - AnthropicExecutor: calls the real Anthropic API (requires ANTHROPIC_API_KEY).
  - MockExecutor: deterministic, no network. Used in DEMO MODE so triggered runs
    work with zero setup. When given a case's expected output as a `hint`, it
    produces a realistic answer with small, deterministic perturbations — so a
    freshly triggered demo run looks like a real eval rather than garbage. The
    real executor never receives or uses the hint.

`get_executor()` picks the implementation: mock when no key is configured (or
when forced), real otherwise.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass

from app.config import get_settings
from app.services.pricing import cost_usd

# Mock executor paces each case slightly so the live-progress UI is observable
# during a triggered demo run. Override with GAUGE_MOCK_DELAY_MS=0 to disable.
_MOCK_DELAY_S = int(os.getenv("GAUGE_MOCK_DELAY_MS", "140")) / 1000

# Models that reject sampling params (temperature/top_p/top_k) — see Anthropic API.
_NO_SAMPLING_PREFIXES = ("claude-opus-4-7", "claude-opus-4-8", "claude-fable-5", "claude-mythos-5")


class GaugeExecutionError(RuntimeError):
    """Raised when a single case fails to execute."""


@dataclass
class CallResult:
    output: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    model: str
    cost_usd: float
    is_mock: bool


def _supports_sampling(model: str) -> bool:
    return not model.startswith(_NO_SAMPLING_PREFIXES)


class AnthropicExecutor:
    is_mock = False

    def __init__(self, api_key: str):
        from anthropic import Anthropic  # noqa: PLC0415 (lazy import)

        self._client = Anthropic(api_key=api_key)

    def run(self, *, system: str, prompt: str, model: str, params: dict, hint: str | None = None) -> CallResult:
        import anthropic  # noqa: PLC0415

        kwargs: dict = {
            "model": model,
            "max_tokens": int(params.get("max_tokens", 1024)),
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        if _supports_sampling(model) and params.get("temperature") is not None:
            kwargs["temperature"] = float(params["temperature"])

        started = time.perf_counter()
        try:
            resp = self._client.messages.create(**kwargs)
        except anthropic.APIStatusError as e:  # 4xx/5xx
            raise GaugeExecutionError(f"Anthropic API error {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise GaugeExecutionError(f"Connection error: {e}") from e
        latency_ms = int((time.perf_counter() - started) * 1000)

        text = "".join(b.text for b in resp.content if b.type == "text").strip()
        in_tok = resp.usage.input_tokens
        out_tok = resp.usage.output_tokens
        return CallResult(
            output=text,
            input_tokens=in_tok,
            output_tokens=out_tok,
            latency_ms=latency_ms,
            model=model,
            cost_usd=cost_usd(model, in_tok, out_tok),
            is_mock=False,
        )


class MockExecutor:
    """Deterministic stand-in. Stable per (model, prompt) so re-runs match."""

    is_mock = True

    def run(self, *, system: str, prompt: str, model: str, params: dict, hint: str | None = None) -> CallResult:
        if _MOCK_DELAY_S > 0:
            time.sleep(_MOCK_DELAY_S)
        seed = int(hashlib.sha256(f"{model}|{prompt}".encode()).hexdigest(), 16)
        output = self._mock_output(hint, seed)

        in_tok = max(1, (len(system) + len(prompt)) // 4)
        out_tok = max(20, len(output) // 4)
        # Plausible synthetic latency by model tier.
        base = 480 if "haiku" in model else 1050
        latency_ms = base + (seed % 600)
        return CallResult(
            output=output,
            input_tokens=in_tok,
            output_tokens=out_tok,
            latency_ms=latency_ms,
            model=model,
            cost_usd=cost_usd(model, in_tok, out_tok),
            is_mock=True,
        )

    @staticmethod
    def _mock_output(hint: str | None, seed: int) -> str:
        """If the expected output is JSON, return it with a small deterministic
        error ~1 in 6 times (drop a value) to mimic a strong-but-imperfect model.
        Otherwise echo the hint, or a generic deterministic string."""
        if not hint:
            return f"[mock output #{seed % 100000}]"
        try:
            obj = json.loads(hint)
        except (json.JSONDecodeError, TypeError):
            return hint
        if isinstance(obj, dict) and obj and seed % 6 == 0:
            # Introduce one realistic mistake: null out a non-null field.
            for key in obj:
                if obj[key] is not None:
                    obj = {**obj, key: None}
                    break
        return json.dumps(obj)


def get_executor(*, force_mock: bool = False):
    settings = get_settings()
    if force_mock or not settings.has_anthropic_key:
        return MockExecutor()
    return AnthropicExecutor(settings.anthropic_api_key)
