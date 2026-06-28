"""FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Gauge API",
    description="Backend for evaluating and regression-testing LLM apps.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.get("/meta", tags=["meta"])
def meta() -> dict[str, object]:
    """Surface runtime capabilities to the frontend.

    `demo_mode` is True when no Anthropic key is configured: triggered runs
    use the deterministic mock executor instead of calling the real model.
    """
    return {
        "demo_mode": not settings.has_anthropic_key,
        "default_model": settings.gauge_default_model,
    }


# Routers are registered as each milestone lands them.
def _register_routers() -> None:
    from app.routers import datasets, runs, tasks  # noqa: PLC0415

    app.include_router(tasks.router)
    app.include_router(datasets.router)
    app.include_router(runs.router)


_register_routers()
