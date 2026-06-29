"""Model pricing and cost helpers.

Prices are USD per million tokens (MTok). These mirror Kimi (Moonshot AI)
published per-model pricing; adjust here if pricing changes. Unknown models
fall back to a mid-tier estimate so cost is never silently zero.
"""

from __future__ import annotations

# model id (or prefix) -> (input $/MTok, output $/MTok)
PRICING: dict[str, tuple[float, float]] = {
    "kimi-k2.7-code": (0.95, 4.0),
    "kimi-k2.6": (0.95, 4.0),
    "kimi-k2.5": (0.60, 3.0),
    "kimi-k2": (0.60, 2.5),  # legacy k2 family
    "moonshot-v1-128k": (2.0, 5.0),
    "moonshot-v1-32k": (1.0, 3.0),
    "moonshot-v1-8k": (0.20, 2.0),
}

_FALLBACK = (0.95, 4.0)


def price_for(model: str) -> tuple[float, float]:
    """Return (input, output) $/MTok for a model id, matching by prefix."""
    for prefix, price in PRICING.items():
        if model.startswith(prefix):
            return price
    return _FALLBACK


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute the USD cost of a single call, rounded to 6 dp."""
    in_rate, out_rate = price_for(model)
    cost = (input_tokens * in_rate + output_tokens * out_rate) / 1_000_000
    return round(cost, 6)
