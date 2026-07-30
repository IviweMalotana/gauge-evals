# The ninety-day plan

The spec measures the first 90 days on seven concrete outcomes. This plan
sequences them so each builds on the last, with a gate at day 30, 60, and 90.
Guiding rule: **adoption beats documentation** — a process the founders don't
use is worse than no process, because it costs credibility.

## The seven success measures → where they land

| Spec success measure | Playbook | Gate |
| -------------------- | -------- | ---- |
| Azure DevOps structure implemented and actively used | 01 | Day 30 |
| Backlog hygiene: priorities, owners, acceptance criteria, status | 01, 02 | Day 30 |
| DoR, DoD, release checklist, UAT checklist, CR process adopted | 02, 03, 04, 05 | Day 60 |
| Baseline API and integration documentation | 08 | Day 60 |
| Client implementation playbook, go-live checklist, issue log | 06 | Day 60 |
| Environment map and platform operations checklist | 07 | Day 90 |
| Monitoring, backup, secrets responsibilities clarified and tracked | 07 | Day 90 |

## Weeks 1–2 — Listen and audit (change nothing yet)

- Shadow both founders. Map how work actually flows today: where requests come
  from, where decisions happen, where they get lost.
- Inventory the current state: repos, existing DevOps/board usage, environments,
  how releases actually happen, what API docs exist, which client
  implementations are in flight.
- Start two artifacts on day one (these are yours, not impositions on anyone):
  a **decision log** (every founder decision you witness, dated) and an
  **issue/risk log**.
- Sit in on at least one client or prospect technical conversation.
- Output: a one-page current-state assessment shared with both founders, and
  agreement on the rollout order below (adjusted to what you found).

## Weeks 3–4 — Delivery backbone (Day-30 gate)

- Stand up the Azure DevOps structure (playbook 01): work item hierarchy,
  required fields, states, area paths, boards, and the hygiene queries.
- Migrate live work into it. Triage the informal backlog with the product
  founder; everything active gets an owner, priority, and acceptance criteria.
- Agree DoR and DoD with both founders (playbook 02) — in a working session,
  not by email. Their edits are what create adoption.
- Start the weekly rhythm (playbook 09): one weekly delivery review, one
  backlog refinement. No more meetings than that yet.
- **Gate check:** founders are creating/updating work items themselves, or at
  least routing everything through you into the board. Zero work arriving as
  "loose requests" untracked for more than a day.

## Weeks 5–8 — Release quality and client motion (Day-60 gate)

- Run one real release through the release checklist (04) and UAT checklist
  (05), then retro and trim both.
- Stand up the change request process (03) and route the next client ask
  through it end-to-end.
- Baseline the API documentation (08): OpenAPI spec current for released
  endpoints, one Postman collection, sample payloads for the top integration
  flows.
- Take the client implementation playbook (06) into the next onboarding —
  workshop agenda, prerequisites checklist, integration plan, issue log.
- **Gate check:** one release shipped through the checklists; one CR through
  the process; a client integration running off the written playbook rather
  than founder memory.

## Weeks 9–12 — Platform operations and proof (Day-90 gate)

- Document the environment map (07) and adopt the platform ops checklist:
  monitoring triage, backup verification, restore-test schedule.
- Close the secrets question explicitly: what lives in Key Vault, who
  administers, who approves, rotation cadence — written as a RACI the
  technical founder signs off.
- Publish the first KPI baseline (09) — you can't show improvement at day 180
  without a day-90 baseline.
- Run a retro **on the operating system itself** with both founders: what's
  working, what's friction, what gets deleted.
- **Gate check:** all seven spec measures demonstrably true, each with a
  living artifact behind it — and at least one process simplified or deleted
  because it wasn't earning its keep.

## Anti-goals (traps the spec itself warns about)

- **Don't become the meeting-notes PM.** Every meeting output is a work item,
  a decision-log entry, or nothing. The spec is explicit this is not a
  "generic project administrator" role.
- **Don't boil the ocean in week 1.** One process change per week, adopted,
  beats ten announced.
- **Don't own architecture.** The technical founder does. You translate
  decisions into delivery work — escalate, don't decide, on platform risks.
- **Don't let client asks become ad hoc custom work.** That's the CR process's
  job from day 30, not day 90 — it's where roadmap erosion starts.
- **Don't measure yourself by documents produced.** Measure by founder
  interruptions going down, releases getting boring, and client questions
  answered by a doc instead of a call.
