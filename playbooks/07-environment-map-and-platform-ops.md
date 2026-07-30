# Environment map & platform operations

The day-90 pillar: environments documented, operational health on a cadence,
and the secrets/backup accountability question answered in writing. Ownership
per the spec: technical founder owns architecture; this role owns/coordinates
operations.

## Environment map (template — fill and keep current)

| Environment | Purpose | URL | Data class | Access (who/how) | Config source | Deployed version | Release route |
| ----------- | ------- | --- | ---------- | ---------------- | ------------- | ---------------- | ------------- |
| Development | Developer integration | | Synthetic only | | | | CI on merge |
| Staging/UAT | Pre-release verification, client UAT | | Anonymised/synthetic | | | | Pipeline, on release-candidate |
| Production | Live clients | | Real, regulated | | | | Pipeline, gated by release checklist |

Rules worth writing down on day one: no real client data outside production
without an explicit, logged exception; production access is named-individual,
least-privilege, reviewed quarterly; staging config drift from production is
a defect, not a fact of life.

## Operations cadence

**Daily (≤10 min):** alert queue triaged (every alert acknowledged — silence
is not triage); overnight job/backup failures checked; client-impacting
anomalies flagged.

**Weekly:** backup **verification** — confirm backups actually completed and
are restorable in principle, not just scheduled; error-rate and performance
scan vs baseline (App Insights / Azure Monitor); pipeline health; ops-notes
entry (one paragraph, feeds the status report).

**Monthly / quarterly:** restore test — actually restore a backup to a
non-production target and verify data (quarterly minimum; monthly during
client-growth phases); access review of production and Key Vault; alert-rule
review (kill alerts nobody acts on); DR walk-through of the rollback and
recovery docs.

## Secrets administration (close this in writing by day 90)

| Question | Answer to agree with technical founder |
| -------- | -------------------------------------- |
| Where do secrets live? | Azure Key Vault (or equivalent) — no secrets in code, pipelines-in-plaintext, or chat. Ever. |
| Who administers? | This role (operations) |
| Who approves new/changed production secrets? | Technical founder |
| Rotation cadence? | e.g. client API keys annually or on personnel change; internal creds per policy |
| Emergency revocation? | Documented one-pager: who can revoke, how fast, who gets told |
| Audit trail? | Key Vault access logging on; reviewed in the quarterly access review |

"No unmanaged production secrets" is a spec KPI — this table, signed, is the
evidence.

## Incidents (lightweight, but written)

Severity: S1 platform down / data at risk → all hands, client comms within
the hour. S2 client-impacting degradation → same day. S3 internal-only →
scheduled.

Every S1/S2 gets a blameless five-liner within 48h: timeline, impact, cause,
fix, prevention item **filed in the backlog**. Repeat incidents without a
prevention item are an escalation to the technical founder by definition.

## Escalation to the technical founder

Escalate — with evidence, options if you have them, and never sat on:
security concerns, recurring failure patterns, capacity/cost anomalies,
anything touching architecture. You coordinate operations; they own the
platform's design and final call.
