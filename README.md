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

When `MOONSHOT_API_KEY` is **unset**, triggered runs use a deterministic
**mock executor** (no network, no cost) so the whole product works end-to-end
with nothing to configure. Set the key and triggered runs call the real
Kimi (Moonshot) API instead.

---

## Architecture

```
┌──────────────────────────┐         ┌───────────────────────────┐
│  web/  Next.js 15 (App    │  HTTP   │  api/  FastAPI (Python 3.12)│
│  Router) + TypeScript +   │ ──────► │  • run engine + scorers     │
│  Tailwind. Operator UI:   │  JSON   │  • Kimi (Moonshot) / mock   │
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

> To run against the real Kimi API, set `MOONSHOT_API_KEY` in `.env`
> before triggering a run. Without it, Gauge stays in mock mode.

---

## Deploy

Gauge deploys as two services from this one repo: the **backend + Postgres on
Railway** and the **frontend on Vercel**. Deploy the backend first so you have
its URL for the frontend's env var.

### 1. Backend + database → Railway

1. **New project → Deploy from GitHub repo**, pointing at this repo.
2. **Set the service root directory to `api/`** (Settings → Root Directory).
   Railway auto-detects Python and installs with `uv`.
3. **Add a Postgres database** to the project (New → Database → PostgreSQL).
   Railway exposes its connection string as `DATABASE_URL` — reference it on
   the API service as `DATABASE_URL=${{Postgres.DATABASE_URL}}`. The app
   normalises the `postgresql://` scheme to the `psycopg` driver automatically.
4. The [`api/Procfile`](./api/Procfile) wires the lifecycle:
   - `release:` runs `alembic upgrade head` (migrations) on every deploy.
   - `web:` starts `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
5. **Set environment variables** (see the table below). At minimum set
   `GAUGE_CORS_ORIGINS` to your Vercel URL. Add `MOONSHOT_API_KEY` to run
   against the real model; leave it unset to stay in mock/demo mode.
6. **Seed the demo once** (optional but recommended for a clickable demo):
   from the service shell, run `python -m app.seed`.

### 2. Frontend → Vercel

1. **New Project → import this repo.**
2. **Set the root directory to `web/`.** Vercel auto-detects Next.js (build
   `next build`, output handled automatically).
3. **Set `NEXT_PUBLIC_API_BASE_URL`** to your Railway backend URL
   (e.g. `https://gauge-api.up.railway.app`). This is read at build time, so
   redeploy after changing it.
4. Deploy. Then add the resulting Vercel URL to the backend's
   `GAUGE_CORS_ORIGINS` and redeploy the backend.

### Environment variables

| Variable                   | Service | Required | Notes                                                        |
| -------------------------- | ------- | -------- | ------------------------------------------------------------ |
| `DATABASE_URL`             | api     | yes      | Postgres URL. `postgresql://` / `postgres://` accepted.      |
| `MOONSHOT_API_KEY`         | api     | no       | Kimi (Moonshot) key. Unset → mock/demo mode. Set → real calls.|
| `MOONSHOT_BASE_URL`        | api     | no       | OpenAI-compatible base URL (default api.moonshot.ai/v1).      |
| `GAUGE_DEFAULT_MODEL`      | api     | no       | Default model for runs (default `kimi-k2.6`).|
| `GAUGE_CORS_ORIGINS`       | api     | yes\*    | Comma-separated allowed web origins (your Vercel URL).       |
| `GAUGE_MOCK_DELAY_MS`      | api     | no       | Per-case pacing for the mock executor (default 140).         |
| `NEXT_PUBLIC_API_BASE_URL` | web     | yes      | Base URL of the backend; read at build time.                 |

\* Required in production so the browser can call the API cross-origin.

### Notes

- **Migrations** run automatically via the Railway `release` phase; no manual
  step needed on deploy.
- **Demo with zero cost**: leave `MOONSHOT_API_KEY` unset — triggered runs use
  the deterministic mock and the seeded history populates every screen.
- **Going live**: set `MOONSHOT_API_KEY`; new runs then call the real model and
  the LLM-as-judge, while historical seeded runs remain for comparison.

## Environment variables

See [`.env.example`](./.env.example) for the authoritative list. Summary:

| Variable                   | Used by  | Purpose                                            |
| -------------------------- | -------- | -------------------------------------------------- |
| `DATABASE_URL`             | api      | Postgres connection string                         |
| `MOONSHOT_API_KEY`         | api      | Kimi (Moonshot) key; unset → mock mode             |
| `GAUGE_DEFAULT_MODEL`      | api      | Default model for runs                             |
| `GAUGE_CORS_ORIGINS`       | api      | Allowed web origins (comma-separated)              |
| `NEXT_PUBLIC_API_BASE_URL` | web      | Base URL of the backend                            |

---

## Status

Built milestone by milestone:

- [x] **M0** — Monorepo scaffold, design system, tooling
- [x] **M1** — DB schema + seeded demo dataset & historical runs
- [x] **M2** — Run engine (Kimi + deterministic mock)
- [x] **M3** — Scorers, incl. LLM-as-judge with shown reasoning
- [x] **M4** — Run view UI
- [x] **M5** — Run comparison / diff (hero feature)
- [x] **M6** — Trend dashboard + trigger-run flow
- [x] **M7** — Case-study landing page
- [x] **M8** — Deploy notes
