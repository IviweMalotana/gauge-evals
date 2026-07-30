# UAT checklist

Client UAT is where implementations succeed or stall. This keeps it scoped,
scripted, and sign-off-able — and makes "unresolved issues risk-assessed
before go-live" (spec §6) an explicit written step instead of a vibe.

## Entry criteria (UAT doesn't start until…)

- [ ] Build deployed to the UAT environment and smoke-tested by us first
- [ ] UAT scripts prepared and shared (template below) covering the agreed scope
- [ ] Client testers named, access working, test credentials/data loaded
- [ ] Data mapping and configuration for this client applied and verified
- [ ] A defect route agreed: where they report, who triages, response times
- [ ] UAT window agreed with dates and a named client sign-off owner

## UAT script template

| # | Scenario | Steps | Test data | Expected result | Pass/Fail | Notes |
| - | -------- | ----- | --------- | --------------- | --------- | ----- |

One row per acceptance criterion; plain language a compliance officer can
execute without a walkthrough call. Scripts derive from story acceptance
criteria — if a script can't be written, the story wasn't Ready.

## Defect triage during UAT

| Severity | Meaning | Go-live rule |
| -------- | ------- | ------------ |
| P1 | Core flow broken, no workaround | Blocks go-live |
| P2 | Significant function impaired, workaround exists | Blocks unless risk-accepted in writing by client + product founder |
| P3 | Minor / cosmetic | Logged, scheduled, doesn't block |
| P4 | Suggestion / improvement | Routed to change request process (playbook 03) |

Triage daily during an active UAT window. Every defect gets: severity, owner,
target date, and a line in the client issue log (playbook 06) — clients judge
you on visible follow-through more than on defect count.

## Exit and sign-off

- [ ] All scripts executed; results recorded (not "mostly went through it")
- [ ] Zero open P1; P2s either fixed or risk-accepted **in writing**
- [ ] P3/P4 list shared with scheduled targets — no silent parking
- [ ] Regression on adjacent existing functionality confirmed clean
- [ ] Client sign-off email/record from the named owner, referencing script
      results and the accepted-risk list
- [ ] Sign-off record linked from the release item (audit trail for regulated
      clients — this is the artifact an auditor asks for)
