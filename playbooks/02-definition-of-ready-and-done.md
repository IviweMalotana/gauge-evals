# Definition of Ready & Definition of Done

Two short gates that stop the two classic failure modes: developers building
from loose requests, and "done" meaning "works on my machine". Agree these
with both founders in a working session — their edits create the adoption.

## Definition of Ready (a story may enter a delivery cycle when…)

- [ ] The user/business outcome is stated in one or two plain sentences
- [ ] Acceptance criteria are written and testable (Given/When/Then preferred)
- [ ] Priority and owner are set
- [ ] Dependencies are identified (client-side, platform, other stories)
- [ ] Estimate attached (S/M/L)
- [ ] Compliance/security implications flagged if any (regulated clients —
      data handling, audit trail, access)
- [ ] The technical founder has seen it (a 2-minute read, not a meeting) and
      raised no architecture objection

Anything failing DoR stays in the backlog — it can be discussed, refined, or
rejected, but not started.

## Definition of Done (a story is Done when…)

- [ ] Acceptance criteria demonstrably pass (link evidence: test run, screen
      capture, or UAT record)
- [ ] Code merged to the release branch via PR — no direct pushes
- [ ] Tests updated/added where the change is testable; regression checklist
      updated if the change adds a critical path
- [ ] API documentation updated if any endpoint/contract changed (playbook 08)
- [ ] Release notes entry drafted (one line, plain language)
- [ ] No known P1/P2 defect open against it
- [ ] Deployed to staging/UAT and verified there — "works locally" is not Done

## Bug-specific Done

- [ ] Root cause noted on the item (one sentence is fine)
- [ ] Repeat-offender check: if this is the second occurrence of the same
      class of issue, a follow-up item exists (product fix, doc fix, or
      process fix — see playbook 07 incident notes)

## Keeping it honest

- Spot-check five Done items monthly against this list; report the miss rate
  in the KPI pack rather than policing individuals.
- If a criterion is skipped three releases running and nothing bad happened,
  propose deleting it. The gate must stay light enough that nobody routes
  around it.
