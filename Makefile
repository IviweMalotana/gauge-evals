# Gauge — developer commands
# Run `make help` for a list.

.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Infra ──────────────────────────────────────────────────────────────

.PHONY: db-up
db-up: ## Start local Postgres (docker-compose)
	docker compose up -d db

.PHONY: db-down
db-down: ## Stop local Postgres
	docker compose down

.PHONY: db-reset
db-reset: ## Drop and recreate local Postgres volume
	docker compose down -v && docker compose up -d db

# ── Backend (/api) ─────────────────────────────────────────────────────

.PHONY: api-install
api-install: ## Install backend deps with uv
	cd api && uv sync

.PHONY: migrate
migrate: ## Apply Alembic migrations
	cd api && uv run alembic upgrade head

.PHONY: seed
seed: ## Seed the demo dataset + historical runs (idempotent)
	cd api && uv run python -m app.seed

.PHONY: api
api: ## Run the FastAPI dev server (http://localhost:8000)
	cd api && uv run uvicorn app.main:app --reload --port 8000

.PHONY: api-test
api-test: ## Run backend tests
	cd api && uv run pytest -q

# ── Frontend (/web) ────────────────────────────────────────────────────

.PHONY: web-install
web-install: ## Install frontend deps
	cd web && npm install

.PHONY: web
web: ## Run the Next.js dev server (http://localhost:3000)
	cd web && npm run dev

# ── Aggregates ─────────────────────────────────────────────────────────

.PHONY: install
install: api-install web-install ## Install all deps

.PHONY: bootstrap
bootstrap: db-up api-install web-install ## First-time setup: db + deps + migrate + seed
	@echo "Waiting for Postgres to be ready..."
	@until docker compose exec -T db pg_isready -U gauge -d gauge >/dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	$(MAKE) seed
	@echo ""
	@echo "✓ Bootstrap complete. Now run the app in two terminals:"
	@echo "    make api   # backend  → http://localhost:8000"
	@echo "    make web   # frontend → http://localhost:3000"

.PHONY: dev
dev: ## Reminder of how to run both servers
	@echo "Run these in two terminals:"
	@echo "  make api   # http://localhost:8000"
	@echo "  make web   # http://localhost:3000"
