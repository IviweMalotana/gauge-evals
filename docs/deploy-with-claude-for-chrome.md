# Deploy Baton with Claude for Chrome

Baton runs on **Railway** (a long-running Node host — it needs a persistent
process, a background worker, and headless Chromium). Your domain
`victorthelabel.com` lives on **Hostking**, which handles DNS only. So the deploy
coordinates two systems:

- **Railway** — builds + runs the app (from the repo's `Dockerfile`), Postgres,
  env vars, and the custom domain.
- **Hostking** — one CNAME record pointing `ticketing.victorthelabel.com` at
  Railway.

Baton is a single Next.js app, so there's **no separate API service** — its API
routes live at `ticketing.victorthelabel.com/api/...`. You don't need an
`api.` subdomain.

Because the repo ships a `Dockerfile` + `railway.json`, Railway builds with
Docker automatically — **there are no build/start commands to configure**, and
Chromium is baked in so the browser-driven QA tests work in production.

Fill the two secrets in the block below, then paste the whole prompt into
**Claude for Chrome**.

---

## The prompt

```
You are operating my browser to deploy a Next.js app ("Baton") to Railway and
connect it to my domain on Hostking. Work carefully, confirm before anything
destructive, and if a screen doesn't match these steps STOP and tell me what you
see. Treat the two secrets as sensitive — only type them into Railway's
Variables fields, never into search, the URL bar, or chat. I'm logged into
Railway, GitHub, and Hostking already; if any isn't, pause and ask me.

SECRETS I'M PROVIDING:
- ANTHROPIC_API_KEY = <<< FILL: my Anthropic key >>>
- AUTH_SECRET       = <<< FILL: a 64-hex random string (openssl rand -hex 32) >>>

FIXED:
- GitHub repo: IviweMalotana/gauge-evals   (branch: main)
- Final app URL: https://ticketing.victorthelabel.com
- DNS host: Hostking (domain victorthelabel.com)

PART A — DEPLOY ON RAILWAY (uses the repo's Dockerfile automatically)
1. Go to https://railway.app; confirm I'm signed in.
2. New Project → Deploy from GitHub repo → IviweMalotana/gauge-evals. Authorize
   Railway's GitHub app if asked. Deploy the "main" branch.
   NOTE: the repo has a Dockerfile + railway.json, so Railway builds with Docker
   automatically. Do NOT set any Build or Start command — leave them blank.
3. New → Database → Add PostgreSQL. Wait until it finishes provisioning.
4. Open the APP service → Variables. Add:
   - DATABASE_URL      = ${{Postgres.DATABASE_URL}}   (exact; links to Postgres)
   - AUTH_SECRET       = (secret above)
   - ANTHROPIC_API_KEY = (secret above)
   - ANTHROPIC_MODEL   = claude-sonnet-4-5
   - APP_URL           = https://ticketing.victorthelabel.com
5. Deploy. Open Build + Deploy Logs and watch. The Docker build takes a few
   minutes (it pulls the Playwright image). Wait for success ("Ready" /
   listening on port). If it fails, read the error and tell me exactly what it
   says — don't retry blindly.

PART B — CUSTOM DOMAIN IN RAILWAY
6. APP service → Settings → Networking → Custom Domain. Enter:
   ticketing.victorthelabel.com
7. Railway shows a DNS target (a value like "xxxxx.up.railway.app"). COPY that
   exact value. Leave this tab open (it'll say "waiting for DNS").

PART C — DNS RECORD IN HOSTKING
8. Open my Hostking client area (https://hostking.co.za) → DNS management / DNS
   Zone Editor for victorthelabel.com (may be under Domains → manage → DNS, or
   cPanel → Zone Editor).
9. Add a record:
   - Type:  CNAME
   - Name / Host:  ticketing
   - Value / Target:  the Railway target from step 7
   - TTL:  default
   Save it. Tell me the exact record you created.

PART D — FINALIZE
10. Back in Railway's Custom Domain panel, wait for it to verify + issue SSL
    (minutes up to ~a couple hours for DNS). If still pending after ~15 min,
    tell me and stop — that's propagation, not an error.
11. Once verified, redeploy the service.

PART E — GITHUB OAUTH (so the pipeline can open real PRs)
12. https://github.com/settings/developers → New OAuth App:
    - Application name: Baton
    - Homepage URL: https://ticketing.victorthelabel.com
    - Authorization callback URL:
      https://ticketing.victorthelabel.com/api/oauth/github/callback
    Register it. Copy the Client ID; Generate a client secret and copy it.
13. Railway → APP service → Variables, add:
    - GITHUB_CLIENT_ID     = (Client ID)
    - GITHUB_CLIENT_SECRET = (secret)
    Redeploy.

PART F — VERIFY
14. Open https://ticketing.victorthelabel.com over HTTPS — you should see the
    Baton landing page. Register a test company; confirm you reach the dashboard.
15. Settings → Connect GitHub → authorize → confirm connected. Then set the
    "App under test" URL to https://ticketing.victorthelabel.com and save.

When done, report: the live URL + whether HTTPS works, the DNS record you added,
whether the deploy logs were clean, and whether GitHub connected.
```

---

## Notes for you (not the agent)

- **Fills:** `ANTHROPIC_API_KEY` = your Anthropic key; `AUTH_SECRET` =
  `openssl rand -hex 32`. The GitHub Client ID/Secret are created by the agent in
  Part E, not fills.
- **DNS takes time.** The `ticketing` CNAME can take minutes to a couple of hours
  before Railway issues SSL. That's normal propagation, not an error.
- **Architecture:** Railway = runtime; Hostking = DNS only. One `CNAME`
  (`ticketing` → Railway's target) connects them.
- **No `api.` subdomain needed** — Baton is one Next.js app; its API routes are
  under the same domain.
- **Preview URLs (later):** once a Railway PR environment exists, grab its URL
  pattern and set the per-branch preview template in Settings (with `{branch}`)
  so the QA browser tests verify the exact change per PR.

See [`DEPLOY.md`](../DEPLOY.md) for the full env-var contract and the Docker
build details.
