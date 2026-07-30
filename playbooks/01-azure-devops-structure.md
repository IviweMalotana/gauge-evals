# Azure DevOps structure

The delivery backbone: how work is typed, fielded, staged, and kept clean.
Lightweight by design — every required field below earns its place in a
report, a gate, or an audit trail; nothing is required "for completeness".

## Work item hierarchy

| Type | Used for | Owned by |
| ---- | -------- | -------- |
| **Epic** | A strategic outcome (e.g. "Client X live", "Audit-ready platform ops") | Product founder (you maintain) |
| **Feature** | A shippable capability under an epic | You |
| **User Story** | One testable slice of a feature, with acceptance criteria | You / product founder |
| **Bug** | Defect with reproduction steps and severity | Anyone; you triage |
| **Task** | Engineering breakdown under a story/bug | Developer |
| **Change Request** | Client- or founder-initiated change to agreed scope (see playbook 03) | You |

Rules of thumb: everything active hangs off an epic; stories are small enough
to finish inside one iteration; a conversation isn't work until it's an item.

## Required fields (backlog hygiene)

Every **active** User Story / Bug / CR carries:

- **Priority** (P1 urgent+important → P4 someday) — set by product founder
- **Owner** — exactly one accountable person
- **Acceptance criteria** — Given/When/Then or a testable checklist (DoR gates this)
- **Estimate** — t-shirt (S/M/L) is enough at this stage
- **Area path** — `Product`, `Platform`, or `Client\<name>`
- **Iteration** — current, next, or backlog
- **Links** — parent feature/epic; related decision-log entry if one drove it

## States

`New → Ready → Active → In Test → In UAT → Done` (+ `Removed`)

- `Ready` requires the Definition of Ready (playbook 02).
- `Done` requires the Definition of Done — not "code complete".
- Bugs skip `Ready` but require reproduction steps + severity to leave `New`.

## Area paths and iterations

- Areas: `Product` (roadmap work), `Platform` (ops, CI/CD, tech debt),
  `Client\<name>` (implementation work per client — keeps custom asks visible).
- Iterations: 2-week cadence to start. Rename to "delivery cycles" if "sprint"
  ceremony feels heavy for a 3-person delivery org — the cadence matters, not
  the vocabulary.

## Standing queries (the hygiene dashboard)

| Query | Catches |
| ----- | ------- |
| Active, no acceptance criteria | Work that can't be tested |
| Active, no owner or no priority | Work that can't be chased |
| In Test / In UAT > 5 working days | Stuck verification |
| Bugs in New > 3 days | Untriaged defects |
| Change Requests in New | CRs awaiting assessment (playbook 03) |
| Done this iteration | Feeds the weekly status report (playbook 09) |

Review the first five queries weekly before the delivery review; the goal for
each is zero.

## Decision log

A `Decision` wiki page (or tagged work item) per significant call: date,
decision, who made it, context, link to affected items. This directly serves
the spec's KPI "reduction in undocumented founder decisions" — when a founder
makes a call in a hallway conversation, it lands here within the day.
