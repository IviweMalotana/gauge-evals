# Deploying Gauge

Gauge is a standard Next.js app. It runs anywhere that can run Node 20 and reach
a PostgreSQL database. These notes cover Railway specifically plus the general
contract.

## ⚠️ Use PostgreSQL in production, not SQLite

Local dev uses SQLite for zero setup. **Do not ship SQLite to a hosted
environment** — platforms like Railway, Render, Fly, and Vercel have ephemeral
filesystems, so a SQLite file is wiped on every redeploy (and isn't shared
across instances). Production must use Postgres.

The data models are provider-agnostic, so the switch is mechanical:

```bash
scripts/db-provider.sh postgresql   # flips prisma/schema.prisma to postgres
```

Set `DATABASE_URL` to your Postgres connection string and you're done.

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string in prod, e.g. `postgresql://user:pass@host:5432/db`. On Railway, reference the Postgres plugin's `DATABASE_URL`. |
| `AUTH_SECRET` | ✅ | Long random string; signs session cookies. Generate with `openssl rand -hex 32`. |
| `APP_URL` | ✅ | Public HTTPS URL of the deployment, e.g. `https://gauge.up.railway.app`. Used for OAuth callbacks. |
| `ANTHROPIC_API_KEY` | recommended | Enables real BRD + planner generation. Without it those agents use a deterministic fallback. |
| `ANTHROPIC_MODEL` | optional | Defaults to a Sonnet model. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | From a GitHub OAuth App; enables connecting GitHub and opening real PRs. |

Secrets live in the host's environment variable store — never commit them
(`.env` is gitignored).

## GitHub OAuth callback

In your GitHub OAuth App, set the **Authorization callback URL** to:

```
${APP_URL}/api/oauth/github/callback
```

It must match `APP_URL` exactly (scheme + host), or the callback's CSRF/state
check will reject the round-trip.

## Railway

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. **Add a PostgreSQL** plugin. Railway exposes its `DATABASE_URL`.
3. In the app service **Variables**, set:
   - `DATABASE_URL` = reference the Postgres plugin variable
   - `AUTH_SECRET`, `APP_URL` (your Railway public URL), `ANTHROPIC_API_KEY`,
     and the GitHub vars if using OAuth.
4. **Build command:**
   ```bash
   bash scripts/db-provider.sh postgresql && npm ci && npx prisma generate && npm run build
   ```
5. **Pre-deploy / release command** (runs migrations against Postgres):
   ```bash
   npx prisma db push
   ```
6. **Start command:** `npm start`

> `prisma db push` syncs the schema without a migration history — fine to start.
> For a tracked migration history, switch to `prisma migrate deploy` with
> committed migrations under `prisma/migrations/`.

### Optional: seed a demo company

One-off, from the Railway shell or a run command:

```bash
npx tsx prisma/seed.ts
```

## Generic (any Node host / Docker)

```bash
scripts/db-provider.sh postgresql
export DATABASE_URL="postgresql://…"
export AUTH_SECRET="…" APP_URL="https://…"
npm ci
npx prisma generate
npx prisma db push
npm run build
npm start        # serves on $PORT (default 3000)
```

## Switching back to SQLite for local dev

```bash
scripts/db-provider.sh sqlite
```

(The committed schema stays on `sqlite` so local/web dev needs no database
service. Only flip it to `postgresql` in the deploy build.)
