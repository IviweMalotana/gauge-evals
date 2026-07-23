# Baton

From stakeholder request to QA-verified pull request — the **BA-to-QA pipeline**.

A company registers, invites collaborators and assigns them roles, and connects
GitHub via OAuth. Stakeholders file requests. Each request runs through an
agent pipeline:

```
UX check → BRD (Given/When/Then) → [human approval] → Plan → Build → Test → Pull request
```

- **UX check** — classifies the request as a bug or a feature. For a bug it
  attempts to reproduce by driving the app (Playwright / a browser MCP); for a
  feature it scopes the change against the code.
- **BRD** — writes business-facing requirements in plain **Given / When / Then**
  Gherkin plus acceptance criteria. Uses **Claude (Sonnet)** via the Anthropic
  API.
- **Human approval** — a reviewer can **accept**, **reject**, or **alter** the
  BRD. Nothing is built until this gate passes.
- **Plan → Build → Test → PR** — planner, builder, and tester agents take the
  approved BRD the rest of the way to an open pull request.

> **Status.** All stages are real, each degrading gracefully when a dependency
> isn't configured:
> - **UX check** drives real headless Chromium to reproduce bugs.
> - **BRD** and **planner** use the Anthropic API (Claude Sonnet).
> - **Builder** reads the repo and commits real code to a branch.
> - **QA** runs three browser-driven checks — **acceptance** (performs the
>   criteria as human actions), **bug-fix review**, and **regression** — against
>   a per-branch preview URL when configured.
> - **PR** opens a real pull request via the stored GitHub token.
>
> Without an API key / connected repo / app URL, each falls back (template BRD,
> code review instead of browser tests, compare-URL instead of a PR) so the
> whole pipeline still runs end-to-end.

## PM Deliverables

Baton also generates classic project-management deliverables from whatever the
workspace already knows (team, requests, BRDs, plans, verification results) —
a hybrid "best of" toolkit across methodologies:

| Deliverable                      | Methodology     |
| -------------------------------- | --------------- |
| Project Charter                  | PMBOK           |
| RACI Matrix                      | PMBOK           |
| Risk Register                    | PMBOK           |
| DMAIC Improvement Plan           | Lean Six Sigma  |
| Status Report                    | Agile           |
| Retrospective & Lessons Learned  | Agile / Kaizen  |

Each deliverable is drafted by Claude (deterministic template without an API
key), **adjustable in-app** (sections + tables, versioned on every edit), and
**shareable across teams**: a stable public link (`/share/d/<token>`) serves it
as a standalone, print-friendly HTML page with no login required, and it can be
downloaded as a self-contained `.html` file. Scope a deliverable to a single
request (charter/retro for one change) or to the whole workspace (status
report, risk register). Find it under **Deliverables** in the top bar.

## Stack

- Next.js 14 (App Router, TypeScript), React Server Components + server actions
- Prisma + SQLite (swap the datasource `provider` to `postgresql` for Postgres)
- Self-contained auth: bcrypt + signed-JWT session cookie (`jose`)
- GitHub OAuth web flow (no external auth library)
- Anthropic SDK for the BRD agent

## Quick start

```bash
npm install
cp .env.example .env        # fill in secrets (see below)
npm run setup               # prisma db push + seed a demo company
npm run dev                 # http://localhost:3000
```

Demo logins (from the seed):

| Role         | Email             | Password      |
| ------------ | ----------------- | ------------- |
| Owner        | ada@acme.test     | password123   |
| Collaborator | grace@acme.test   | password123   |
| Stakeholder  | stan@acme.test    | password123   |

Or register a fresh company at `/register`.

## Deploying

See **[DEPLOY.md](./DEPLOY.md)** for hosting (Railway + generic). Key point:
production must use **Postgres**, not SQLite — flip the provider with
`scripts/db-provider.sh postgresql` and set `DATABASE_URL`. Secrets
(`ANTHROPIC_API_KEY`, `AUTH_SECRET`, GitHub OAuth) live in the host's env vars.

## Configuration

See `.env.example`. Notable variables:

- `DATABASE_URL` — SQLite file by default.
- `AUTH_SECRET` — signs session cookies. Use a long random string.
- `APP_URL` — base URL for OAuth callbacks.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from a GitHub OAuth App.
  Set the callback URL to `${APP_URL}/api/oauth/github/callback`.
- `ANTHROPIC_API_KEY` — enables real BRD generation. Without it the BRD agent
  falls back to a deterministic template so the pipeline still runs end-to-end.
- `ANTHROPIC_MODEL` — defaults to a Sonnet model; override as needed.

## How it fits together

```
src/
  app/
    (auth)/            register + login
    (app)/             authenticated shell (dashboard, requests, members, settings)
    api/oauth/github/  OAuth start + callback
    actions/           server actions (auth, requests, members, settings)
  components/          TopBar, AddMemberForm, BrdApproval
  lib/
    auth.ts            sessions, password hashing, role helpers
    db.ts              Prisma client
    anthropic.ts       Anthropic client + JSON completion helper
    agents/            uxCheck, brd, planner, builder, tester, pr, orchestrator
prisma/
  schema.prisma        Company, User, Membership, Request + pipeline artifacts
  seed.ts              demo company
```

The pipeline is orchestrated in `src/lib/agents/orchestrator.ts`, split into
`runToApproval` (phase 1, up to the human gate) and `runAfterApproval`
(phase 2, build through QA + PR). Both run on a background worker
(`src/lib/queue.ts`) so filing a request returns immediately.

## Roles

| Role         | Can do                                                       |
| ------------ | ----------------------------------------------------------- |
| Owner        | Everything, incl. company settings and member management    |
| Admin        | Manage members & settings, run the pipeline                 |
| Collaborator | File and run requests                                        |
| Stakeholder  | File requests and approve/reject                            |

## Roadmap

- Provision Chromium on the production host so the browser-driven checks run in
  deployment (not just locally)
- Wire the per-branch preview URL to the host's PR-environment pattern
- A real broker if running multiple instances (single instance is handled)
- An automated test suite for Baton itself
