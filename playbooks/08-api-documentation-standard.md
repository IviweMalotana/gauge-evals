# API documentation standard

Docs exist to make client developers self-sufficient. The KPI is "reduction
in repeated client integration questions" — every question answered twice on
a call becomes a doc section the same week.

## Source of truth

- **OpenAPI/Swagger spec** is canonical for endpoints, schemas, and auth.
  Generated from code where possible; where hand-maintained, updating it is a
  Definition-of-Done item for any contract change (playbook 02) and a release
  checklist item (playbook 04). Docs that lag releases are worse than no docs
  — clients build against them.
- **Postman collection** mirrors the spec: one folder per integration use
  case, environment files for sandbox vs production, working example calls.
- **Integration guide** (human prose) sits above both: the "how do I get from
  zero to first successful call" narrative.

## Per-endpoint template

- **Purpose** — one sentence, business language ("Submit a customer for
  screening"), then the technical shape
- **Auth** — scheme, how to obtain credentials, token lifetime, sandbox vs
  production differences
- **Request** — method, path, parameters table (name, type, required,
  description, validation), one **complete working sample payload** (realistic
  fake data — never real client data)
- **Response** — success example, every documented status code, pagination if
  any
- **Errors** — code, meaning, and *what the caller should do about it*
  (retry? fix payload? contact us?) — the column most docs skip and the one
  integrators need
- **Limits & behaviour** — rate limits, idempotency, timeouts, retry guidance,
  async callbacks if any

## Integration guide skeleton

1. Getting access (keys, environments, allow-listing)
2. First successful call in 15 minutes (copy-paste curl/Postman walkthrough)
3. Core flows, one section each, with sequence of calls and sample payloads
4. Error handling and retry patterns
5. Sandbox vs production differences
6. FAQ / troubleshooting — seeded from real client questions, grows weekly
7. Changelog — contract changes by release, with dates and migration notes

## Working agreement with the technical founder

You own the documentation layer; they own API behaviour and design. For new
endpoints, you contribute the consumer view early — endpoint requirements,
data contracts, use cases, acceptance criteria — so client-facing usability
is designed in, not documented around.

## Currency check (monthly, 15 minutes)

Diff released endpoints against the spec; run the Postman collection against
sandbox — broken examples are P2 defects; skim the FAQ for staleness. Report
doc currency in the KPI pack honestly — "docs 2 releases behind" is a
finding, not a failure to hide.
