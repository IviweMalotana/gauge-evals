# Deploy Gauge to Railway with Claude for Chrome

Paste the prompt below into **Claude for Chrome** (the browser-driving agent),
after filling in the `FILL THESE IN` block. The agent will drive Railway for
you: create the project, add Postgres, set env vars, configure the build, deploy,
and verify.

Everything the agent needs is also in [`DEPLOY.md`](../DEPLOY.md).

---

## The prompt

> You are operating my browser to deploy a Next.js app called **Gauge** to
> **Railway**. Work carefully, confirm before anything destructive, and if you
> get stuck or a screen doesn't match these steps, stop and tell me what you see
> rather than guessing. Treat every value in the "FILL THESE IN" block as a
> secret: only type them into Railway's Variables fields, never into a search
> box, URL bar, chat, or anywhere they'd be logged or shown.
>
> ### FILL THESE IN
> - GitHub repo: `IviweMalotana/gauge-evals`
> - Branch to deploy: `main`  (merge PR #1 first, or set this to
>   `claude/tender-knuth-9b68q6` for a preview deploy)
> - `ANTHROPIC_API_KEY`: `<paste my Anthropic key>`
> - `AUTH_SECRET`: `<paste a long random string, or generate one: 64 hex chars>`
> - GitHub OAuth (optional, can skip on first deploy):
>   - `GITHUB_CLIENT_ID`: `<from a GitHub OAuth App, or leave blank>`
>   - `GITHUB_CLIENT_SECRET`: `<from a GitHub OAuth App, or leave blank>`
>
> ### Steps
>
> 1. Go to https://railway.app and make sure I'm signed in. If not, stop and ask
>    me to sign in, then continue.
>
> 2. Create a new project: **New Project → Deploy from GitHub repo**. Select
>    `IviweMalotana/gauge-evals`. If Railway asks to install/authorize its GitHub
>    app for the repo, do so. Choose the branch from the FILL THESE IN block.
>
> 3. Add a database: in the project, **New → Database → Add PostgreSQL**. Wait
>    for it to provision. This creates a `Postgres` service that exposes a
>    `DATABASE_URL`.
>
> 4. Open the **app service** (the one built from the repo) → **Variables** tab.
>    Add these variables (New Variable for each):
>    - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  (this is Railway's
>      reference syntax — type it exactly so it links to the Postgres service)
>    - `AUTH_SECRET` = the value from FILL THESE IN
>    - `ANTHROPIC_API_KEY` = the value from FILL THESE IN
>    - `ANTHROPIC_MODEL` = `claude-sonnet-4-5`
>    - `NODE_ENV` = `production`
>    - (Only if I provided them) `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
>    - Leave `APP_URL` for step 7 (we need the domain first).
>
> 5. Configure the build in the app service → **Settings**:
>    - **Build Command:**
>      `bash scripts/db-provider.sh postgresql && npm ci && npx prisma generate && npm run build`
>    - **Pre-Deploy Command** (a.k.a. release command, if the field exists):
>      `npx prisma db push`
>    - **Start Command:** `npm start`
>    - If there's no separate Pre-Deploy field, instead set the Build Command to:
>      `bash scripts/db-provider.sh postgresql && npm ci && npx prisma generate && npm run build && npx prisma db push`
>
> 6. Trigger a deploy (Deploy / Redeploy). Open the **Deploy Logs** and watch
>    until it either succeeds (server listening) or fails. If it fails, read the
>    error and tell me what it says — don't retry blindly more than once.
>
> 7. Give the app a public URL: app service → **Settings → Networking →
>    Generate Domain**. Copy the `https://…railway.app` URL. Then go back to
>    **Variables** and add:
>    - `APP_URL` = the generated `https://…` URL (no trailing slash)
>    Redeploy so `APP_URL` takes effect.
>
> 8. Verify: open the `APP_URL` in a new tab. You should see the Gauge landing
>    page. Click **Get started / Create your company**, register a test company,
>    and confirm you land on the dashboard. Report the final URL to me.
>
> 9. (Optional — GitHub OAuth) Only if I gave you a `GITHUB_CLIENT_ID`: go to
>    https://github.com/settings/developers → the OAuth App → set the
>    **Authorization callback URL** to `<APP_URL>/api/oauth/github/callback`
>    (exactly matching APP_URL). Save. Then in Gauge → Settings, click
>    **Connect GitHub** and confirm it round-trips back connected.
>
> When done, give me: the live URL, whether the deploy logs were clean, and
> anything you had to change from these steps.

---

## Notes for you (not the agent)

- **Merge or preview?** Railway deploys a branch. Either merge PR #1 into `main`
  and deploy `main`, or point the service at `claude/tender-knuth-9b68q6` for a
  throwaway preview.
- **Generating `AUTH_SECRET`:** run `openssl rand -hex 32` locally and paste the
  output into the prompt.
- **GitHub OAuth App:** create one at
  https://github.com/settings/developers (New OAuth App). Homepage = your
  `APP_URL`; callback = `<APP_URL>/api/oauth/github/callback`. You can add this
  after the first deploy once you know the domain.
- **Why the Postgres switch:** the repo ships on SQLite for local dev; the build
  command flips it to Postgres so Railway's database is used (SQLite would be
  wiped on redeploy).
