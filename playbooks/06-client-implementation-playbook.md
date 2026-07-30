# Client implementation playbook

The repeatable path from "contract signed" to "client live and stable" — so
implementation #6 costs a fraction of implementation #1 and doesn't depend on
founder memory. One copy of this per client, in `Client\<name>` area path.

## Phase 1 — Kickoff & technical onboarding workshop

Agenda (90 minutes, client IT + compliance + ops in the room):

1. Platform architecture overview and data flows (technical founder or you)
2. Integration surface: which APIs, auth model, environments available to them
3. Data requirements: what they send, formats, validation, mapping approach
4. Security expectations: access model, data handling, credentials, their
   security-review needs (regulated clients will have a questionnaire — ask
   for it now, not in week 4)
5. Testing approach: sandbox, UAT window, who tests what
6. Go-live shape: date targets, cutover approach, rollback, support model
7. Names: their technical lead, our escalation path, weekly check-in slot

Output within 48h: implementation plan (below) + prerequisites checklist sent.

## Phase 2 — Prerequisites (client-side dependencies, chased weekly)

- [ ] Sandbox access provisioned; client confirms login
- [ ] API keys / test credentials issued and receipt confirmed
- [ ] Sample data files received in agreed format
- [ ] Data mapping doc completed and signed off (template: our field, their
      field, transformation, required?, validation rule, owner)
- [ ] Client-side firewall/allow-listing done (their IT often the long pole)
- [ ] Security questionnaire exchanged if required
- [ ] Named client testers for UAT

Track these as tasks with dates — client-side dependencies slip silently, and
the go-live date moves with them; make the linkage visible early.

## Phase 3 — Integration & testing

- Integration plan per interface: endpoint set, auth, payload examples
  (playbook 08), error handling, retry expectations, volume assumptions
- Weekly check-in during active integration; issue log reviewed every time
- Client UAT run per playbook 05

## Phase 4 — Go-live checklist

- [ ] UAT signed off (P1s zero, P2s risk-accepted in writing)
- [ ] Production credentials issued, tested, sandbox keys deactivated on cutover
- [ ] Production configuration/data mapping applied and peer-checked
- [ ] Monitoring in place for this client's traffic (playbook 07)
- [ ] Support path communicated: contacts, hours, severity definitions, response targets
- [ ] Go-live comms scheduled (who tells whom, when, rollback trigger agreed)
- [ ] Hypercare window agreed (e.g. 2 weeks of daily checks + priority routing)
- [ ] Post-hypercare handover to standard support recorded

## Issue log (one per client, shared with them)

| ID | Raised | Severity | Description | Owner | Status | Target | Resolution |
| -- | ------ | -------- | ----------- | ----- | ------ | ------ | ---------- |

Shared visibility is the trust instrument: clients escalate when they can't
see motion. Review at every check-in; escalation path is you → relevant
founder → founder-to-sponsor, with dates on every escalation.

## After each go-live

30-minute internal retro: what did this client hit that the playbook didn't
cover? Fold it in. The playbook converging to "no surprises" *is* the
"repeatable implementations" success measure.
