# Weekly operating rhythm & reporting

The cadence is the product delivery operating system made visible. Few
meetings, each with a fixed output; one report serving founders, CFO
governance, and (summarised) investors.

## The cadence

| Ritual | When | Who | Fixed output |
| ------ | ---- | --- | ------------ |
| Delivery review | Weekly, 30 min | You + both founders | Priorities confirmed; CR decisions made; blockers assigned |
| Backlog refinement | Weekly, 45 min | You + product founder (tech founder on call) | Next cycle's items meet DoR |
| Client implementation check-in | Weekly per active client, 30 min | You + client technical lead | Issue log reviewed; dependencies chased |
| Release readiness | Per release, 30 min | You + technical founder | Go/no-go recorded (playbook 04) |
| Ops review | Monthly, 30 min | You + technical founder | Ops checklist status; incidents; secrets/access items |
| Operating-system retro | Monthly, 30 min | You + both founders | One process improved or deleted |

Daily standup only if the developer count grows past the founders — until
then the weekly review plus the board carries it.

## Weekly status report (one page, same shape every week)

1. **Shipped** — Done items, releases, client milestones
2. **In flight** — current cycle vs plan (on/at-risk/off, one line why)
3. **Client implementations** — per client: phase, next milestone, RAG, top issue
4. **Decisions needed** — the asks, each with options and a recommendation
5. **Risks** — top 3-5 with owner and movement since last week
6. **Ops note** — releases, incidents, backup/monitoring status in one line

Same document feeds the CFO's governance pack and condenses to an investor
paragraph — write it once, slice it three ways.

## KPI pack (monthly, baselined at day 90)

The spec's own measures, made countable:

| Area | Metric | Source |
| ---- | ------ | ------ |
| Product delivery | % active items with acceptance criteria; release predictability (planned vs shipped); cycle time P1 items | DevOps queries |
| Client implementations | Time to go-live; UAT completion rate; integration defect rate; open issue age | Implementation plans + issue logs |
| Platform operations | Deployment success rate; backup verifications done vs due; restore tests done; alerts triaged same-day; unmanaged secrets (target 0) | Pipelines + ops notes |
| API & docs | Doc currency (releases behind); repeated client questions/mo; sample-payload coverage of live endpoints | Currency check (playbook 08) |
| Release quality | Defect leakage per release; regression coverage of critical paths; release-notes completeness | Release records |
| Founder leverage | Ad hoc interruptions/wk (founders' own estimate); undocumented decisions found after the fact; loose requests reaching the tech founder | Decision log + founder pulse |

Report trends honestly, including the bad ones — the KPI pack is your case
for what to fix next, and (at review time) the evidence of what the role
changed.
