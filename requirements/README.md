# Requirements corpus

The living, version-controlled requirements for this repository, written as
Cucumber/Gherkin `.feature` files (Feature / Scenario / Given-When-Then).
Seeded by **Baton** from the current codebase; this is the source of
truth for behaviour. Each file's tags carry metadata (`@id`, category,
`@status`, `@v`, `@code:` paths, `@related`).

### ux
- `requirements/ux/REQ-ec6caa0b.feature` — Company registration and owner onboarding
- `requirements/ux/REQ-b9939bc8.feature` — User authentication and session management
- `requirements/ux/REQ-eb42c1da.feature` — Dashboard overview of request pipeline activity
- `requirements/ux/REQ-e7a51bc7.feature` — Filing a new request to trigger the pipeline
- `requirements/ux/REQ-c56c6152.feature` — Viewing and filtering all company requests
- `requirements/ux/REQ-02bc7c5f.feature` — Viewing request detail and pipeline progress
- `requirements/ux/REQ-52a472ba.feature` — Approving or rejecting a BRD to gate pipeline progression
- `requirements/ux/REQ-49699458.feature` — Managing team members and roles
- `requirements/ux/REQ-81f56fa9.feature` — Configuring company settings and GitHub integration

### backend
- `requirements/backend/REQ-b6f65576.feature` — Multi-agent pipeline orchestration for request processing
- `requirements/backend/REQ-ae3153e9.feature` — Background job queue for asynchronous agent execution

### data
- `requirements/data/REQ-fa411515.feature` — Multi-tenant data model with company-scoped entities
- `requirements/data/REQ-2fd4fdae.feature` — Requirements corpus storage for seeding baseline BRDs

### api
- `requirements/api/REQ-01423cff.feature` — GitHub OAuth flow for repository access
- `requirements/api/REQ-a9b01df2.feature` — Diagnostic endpoint for testing Anthropic API connectivity

_Total: 15 requirement(s)._
