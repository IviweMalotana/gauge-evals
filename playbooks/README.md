# Instarc Delivery Operating System — landing kit

A ready-to-adopt process kit for the **Technical Delivery & Platform Manager**
role at Instarc, mapped one-to-one to the job spec's first-90-days success
measures. Walk in on day one with the operating system already drafted; spend
the 90 days *adopting and tuning* it with the founders instead of writing it.

| # | Playbook | Covers (from the spec) |
| - | -------- | ---------------------- |
| 00 | [Ninety-day plan](00-ninety-day-plan.md) | The phased execution plan with gates at day 30 / 60 / 90 |
| 01 | [Azure DevOps structure](01-azure-devops-structure.md) | Epics → Features → Stories/Bugs/Tasks/CRs, fields, states, backlog hygiene |
| 02 | [Definition of Ready & Done](02-definition-of-ready-and-done.md) | DoR / DoD documented and adopted |
| 03 | [Change request process](03-change-request-process.md) | CR intake, assessment, roadmap protection |
| 04 | [Release checklist](04-release-checklist.md) | Release readiness, notes, rollback, hotfixes |
| 05 | [UAT checklist](05-uat-checklist.md) | UAT scripts, defect triage, sign-off, risk-assessed go-live |
| 06 | [Client implementation playbook](06-client-implementation-playbook.md) | Onboarding workshops, integration plan, go-live checklist, issue log |
| 07 | [Environment map & platform ops](07-environment-map-and-platform-ops.md) | Env map, monitoring, backup verification, secrets RACI |
| 08 | [API documentation standard](08-api-documentation-standard.md) | Endpoint docs, OpenAPI/Postman, sample payloads, FAQs |
| 09 | [Weekly operating rhythm](09-weekly-operating-rhythm.md) | Cadence, status reporting, the spec's KPI set |

## The one-page shareable handbook

All ten playbooks compile into a single self-contained HTML handbook —
clickable table of contents, no external assets, safe to email or drop in a
wiki:

```bash
node scripts/build-playbooks.mjs   # writes playbooks/instarc-delivery-os.html
```

Adjust the markdown (that's the source of truth), rebuild, reshare.

## How to use this in week 1

1. Read `00-ninety-day-plan.md` — it sequences everything else.
2. Don't roll any of this out on day 1. Weeks 1–2 are for listening and
   auditing; the kit gets tuned to what you find, then adopted one piece per
   week with founder agreement.
3. Every template in here is deliberately lightweight. The spec warns against
   becoming a bureaucrat — if a checklist item never catches anything, delete it.
