# Gauge

**A lightweight harness for evaluating and regression-testing LLM apps.**

Define a task (a prompt/system under test) and a dataset of test cases, run the
task across every case, score each output with pluggable scorers (including an
LLM-as-judge), store every run, and **diff runs side by side** so regressions
are obvious at a glance.

> Gauge is built the way you'd build internal tooling for a production AI team:
> typed end-to-end, seeded with a real demo dataset, and clickable with zero
> setup. The run-to-run diff is the hero feature.

---

## What it does

- **Tasks & datasets** — define a prompt/system under test and a dataset of
  cases (`input` + `expected` output or a grading `rubric`).
- **Run engine** — execute a task across all cases against a chosen model and
  params, capturing output, latency, tokens, and cost per case.
- **Pluggable scorers** — exact-match, contains, regex, JSON-schema validity,
  and an **LLM-as-judge** that grades against a rubric and shows its reasoning.
- **Run history & diff** — store every run; compare two runs side by side with
  regressions in red and improvements in green.
- **Trend dashboard** — score, latency, and cost trends over runs per task.
- **Trigger runs from the UI** — pick a task, model, and params and watch it
  execute with live progress.

## Demo mode (zero setup)

Gauge ships a **public demo**: the seed script loads a realistic task with a
full dataset and several historical runs, so every screen — dashboards, run
views, and the diff — is populated and clickable immediately.

When `ANTHROPIC_API_KEY` is **unset**, triggered runs use a deterministic
**mock executor** (no network, no cost) so the whole product works end-to-end
with nothing to configure. Set the key and triggered runs call the real
Anthropic API instead.

---

## Architecture

```
┌──────────────────────────┐         ┌───────────────────────────┐
│  web/  Next.js 15 (App    │  HTTP   │  api/  FastAPI (Python 3.12)│
│  Router) + TypeScript +   │ ──────► │  • run engine + scorers     │
│  Tailwind. Operator UI:   │  JSON   │  • Anthropic SDK / mock     │
│  tasks, runs, diff, trends│ ◄────── │  • SQLAlchemy + Alembic     │
└──────────────────────────┘         └─────────────┬─────────────┘
                                                    │
                                            ┌───────▼────────┐
                                            │  Postgres       │
                                            │  tasks, datasets│
                                            │  cases, runs,   │
                                            │  results        │
                                            └────────────────┘
   Frontend → Vercel        Backend + DB → Railway
```

**Repo layout**

```
gauge-evals/
├── web/                 # Next.js 15 frontend (Vercel)
├── api/                 # FastAPI backend (Railway)
│   ├── app/             # application code
│   ├── alembic/         # database migrations
│   └── tests/
├── docker-compose.yml   # local Postgres
├── Makefile             # dev commands (run `make help`)
└── .env.example         # copy to .env
```

---

## Run locally

**Prerequisites:** Docker (for Postgres), [`uv`](https://docs.astral.sh/uv/),
Node 20+.

```bash
# 1. Configure env
cp .env.example .env          # defaults work out of the box (mock mode)

# 2. First-time setup: start Postgres, install deps, migrate, seed
make bootstrap

# 3. Run the two servers in separate terminals
make api    # FastAPI  → http://localhost:8000  (docs at /docs)
make web    # Next.js  → http://localhost:3000
```

Then open **http://localhost:3000**.

Run `make help` to see all commands (`db-up`, `migrate`, `seed`, `api-test`, …).

> To run against the real Anthropic API, set `ANTHROPIC_API_KEY` in `.env`
> before triggering a run. Without it, Gauge stays in mock mode.

---

## Deploy

Deployment notes for **Vercel** (frontend) and **Railway** (backend + Postgres),
including the full env-var list, land in Milestone 8.

## Environment variables

See [`.env.example`](./.env.example) for the authoritative list. Summary:

| Variable                   | Used by  | Purpose                                            |
| -------------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`             | api      | Postgres connection string                         |
| `ANTHROPIC_API_KEY`        | api      | Enables real model calls; unset → mock mode        |
| `GAUGE_DEFAULT_MODEL`      | api      | Default model for runs                             |
| `GAUGE_CORS_ORIGINS`       | api      | Allowed web origins (comma-separated)              |
| `NEXT_PUBLIC_API_BASE_URL` | web      | Base URL of the backend                            |

---

## Status

Built milestone by milestone:

- [x] **M0** — Monorepo scaffold, design system, tooling
- [ ] **M1** — DB schema + seeded demo dataset & historical runs
- [ ] **M2** — Run engine (Anthropic + deterministic mock)
- [ ] **M3** — Scorers, incl. LLM-as-judge with shown reasoning
- [ ] **M4** — Run view UI
- [ ] **M5** — Run comparison / diff (hero feature)
- [ ] **M6** — Trend dashboard + trigger-run flow
- [ ] **M7** — Case-study landing page
- [ ] **M8** — Deploy notes
