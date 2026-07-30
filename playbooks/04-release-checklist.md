# Release checklist

Every release has clear scope, acceptance status, rollback considerations,
release notes, and post-release follow-up (spec §6). The aim is boring
releases: same steps, every time, in writing.

## Release readiness review (T-2 days, ~30 minutes)

- [ ] **Scope frozen** — a query lists exactly the items in this release; all
      are Done per DoD; nothing rides along unlisted
- [ ] **Regression checklist run** on staging/UAT and passing (critical paths:
      auth, core compliance workflow(s), key API endpoints, client-facing flows)
- [ ] **Open defects reviewed** — no P1/P2 in scope; any known-issue shipping
      anyway is risk-assessed in writing and accepted by the product founder
- [ ] **Release notes drafted** — plain language, client-safe, includes any
      action a client integration team must take
- [ ] **API docs current** for any contract change (playbook 08)
- [ ] **Rollback plan stated** — previous version tag, DB migration
      reversibility checked, config/secrets changes listed, who executes
- [ ] **Client impact assessed** — which clients notice? Notification needed?
      Timing conflicts with anyone's UAT or go-live?
- [ ] **Go/no-go recorded** — who said go, when (one line in the release item)

## Release execution

- [ ] Deploy via pipeline from the release branch — no manual file pushes
- [ ] Smoke test in production immediately (login, one core workflow, one API
      round-trip — scripted list, ≤10 minutes)
- [ ] Monitoring watched for the first hour; alert thresholds sane
- [ ] Release notes published / sent; release item closed with deploy time

## Post-release (within 48 hours)

- [ ] Error rates / alerts compared against pre-release baseline
- [ ] Client-reported issues triaged against the release
- [ ] **Defect leakage recorded** — production defects traced to this release
      (KPI feed)
- [ ] 15-minute retro when anything surprised you; checklist updated the same
      day (that's how it stays alive)

## Hotfix lane

Same checklist, compressed: scope = the fix only; regression = affected area
plus smoke set; approval = technical founder go/no-go verbally, logged after.
A hotfix skips ceremony, never the record — undocumented emergency changes
are how regulated-client audits go bad.
