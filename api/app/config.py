"""Application configuration, loaded from the environment (and a local .env)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    Values are read from environment variables. For local development a
    repo-root `.env` is loaded automatically (see `model_config`).
    """

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://gauge:gauge@localhost:5432/gauge"

    # Anthropic. When empty, the runner uses a deterministic mock executor so
    # the product is fully usable with zero setup (DEMO MODE).
    anthropic_api_key: str = ""
    gauge_default_model: str = "claude-haiku-4-5-20251001"

    gauge_cors_origins: str = "http://localhost:3000"

    @property
    def has_anthropic_key(self) -> bool:
        return bool(self.anthropic_api_key.strip())

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.gauge_cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
