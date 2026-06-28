"""Model pricing and cost helpers.

Prices are USD per million tokens (MTok). These mirror Anthropic's published
per-tier pricing; adjust here if pricing changes. Unknown models fall back to a
mid-tier estimate so cost is never silently zero.
"""

from __future__ import annotations

# model id (or prefix) -> (input $/MTok, output $/MTok)
PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-haiku-4": (1.0, 5.0),
    "claude-3-5-haiku": (0.80, 4.0),
    "claude-3-5-sonnet": (3.0, 15.0),
}

_FALLBACK = (3.0, 15.0)


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
