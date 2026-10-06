# AI Senior BA / Software Delivery Intelligence Platform — Product Spec

This is the canonical product specification for Baton (the codename of this
repo's implementation). It sits above existing software delivery tooling and
acts as the persistent BA / product-delivery intelligence layer connecting:

Business brief → requirements → documentation → UX → development → QA →
regression → verification → release → living product documentation.

## 1. Core product principle

The system maintains a persistent understanding of a software product. The
canonical chain is:

```
Business Brief → Discovery → Requirements → Business Rules → User Stories
→ Gherkin Scenarios → UX/UI spec → Jira Ticket → Build Context
→ GitHub Branch/PR → Implementation → Playwright Tests → QA → Regression
→ Dev Verification → Release → Release Notes → Updated Product Documentation
```

Every stage must be traceable to the previous stage. The platform must be
able to answer:

- Why does this feature exist? What business requirement created it?
- Which Jira ticket implements it? Which GitHub PR changed it?
- Which tests validate it? What other parts of the application are affected?
- What documentation needs updating? What changed between product versions?

## 2. Do not rebuild existing tools

First-class integrations (sources of truth, not replacements):

- **Jira** — projects, epics, issues, status, assignees, priority, sprint,
  history. (Not a Jira replacement.)
- **GitHub** — repositories, branches, commits, PRs, code, Actions, existing
  tests. (Not a GitHub replacement.)
- **Anthropic / Claude** — AI provider. Customer connects their own account.
  Must NOT hard-code one model: provider/model abstraction so OpenAI, Google,
  etc. can be added.
- **Playwright** — execution/testing. Detect existing setup, understand
  existing tests, create/run tests where authorized, collect results.

## 3. Multi-tenant architecture

```
Organization → Users → Projects → Integrations → Product/Application
→ Epics → Tickets → Requirements → Documentation → Tests → Releases
```

Every record belongs to an organization. Roles: Owner, Admin, BA, Product,
Developer, QA, Viewer.

## 4. Onboarding / initialization

1. Connect Jira. 2. Connect GitHub. 3. Connect AI provider. 4. Select Jira
project. 5. Select GitHub repository. 6. Select branch/environment.
7. Configure Playwright. 8. Start Product Initialization.

Distinguish: Observed / Strongly inferred / Unknown / Requires human
confirmation.

## 5. Repository discovery

Analyze: structure, languages, frameworks, routes, pages, components,
services, API endpoints, DB models, auth, business logic, integrations, env,
tests, Playwright tests, CI/CD, design-system patterns. Incremental and
cacheable — never re-scan the whole repo per ticket. Persistent application
knowledge model.

## 6. Product knowledge model

Structured internal representation: Modules, Screens, Routes, Components,
Entities, APIs, Business Rules, Integrations, Permissions, User Journeys,
Tests, Requirements, Decisions, Dependencies. GitHub is the implementation
source of truth; this model is the platform's understanding of it.

## 7. Initial product baseline

Product map (modules, features, screens, user journeys). Architecture via
C4 (Context, Container, Component). Business/process flows via BPMN. Data
via ERD. API via OpenAPI. Existing requirements extracted from repo + Jira
+ docs + tests + config. Every generated requirement has provenance.

## 8. Existing UX model

Analyze existing UI: screens, navigation, user journeys, states, forms,
validation, errors, loading, empty, permissions, responsive. Produce a
clickable representation of the current application. Not a Figma
replacement — a machine-readable UX model.

## 9. Project dashboard

Portfolio view: Projects → Timeline → Epics → Deliverables → Tickets →
Status → Risks → Dependencies → Recent releases. Jira remains source of
truth; the platform adds intelligence, documentation, traceability.

## 10. Ticket lifecycle

```
INTAKE → ANALYSIS → QUESTIONS → REQUIREMENTS_DRAFT → AWAITING_ACCEPTANCE
→ ACCEPTED → BUILD_READY → DESIGN_UX → BUILDING → QA → REGRESSION
→ VERIFICATION → DONE
```

Gates enforced. **A build cannot begin until relevant requirements are
accepted.**

## 11. BA agent

Reads brief, inspects context (product + Jira + GitHub), identifies impacts,
missing info, assumptions, dependencies, risks; defines requirements,
business rules, user stories, Gherkin, edge cases, error states; performs
impact analysis; prepares build-ready docs and QA scenarios; maintains
traceability. Behaves like a strong senior BA — not a generic generator.

## 12. Requirements

Gherkin/Cucumber as canonical. States: draft, accepted, rejected,
superseded, changed. Acceptance is a human-controlled gate. Version
history.

## 13. Documentation

Project: brief, objectives, scope, stakeholders, timeline, risks,
dependencies, RAID, decisions, change history.

Epic: brief, business outcome, scope, dependencies.

Ticket: brief, discovery, questions, answers, assumptions, requirements,
business rules, user stories, Gherkin, process flows, data, UX, edge
cases, errors, dependencies, impact, build spec, QA scenarios, defects,
regression, verification, sign-off.

Living — completed ticket → affected docs identified and updated.

## 14. Traceability engine

Relationships: Brief → Requirement → Business Rule → Gherkin → UX → Jira
Ticket → GitHub Branch → PR → Code refs → Playwright Test → QA Result →
Release → Release Note. Reverse lookup supported.

## 15. Impact analysis

Requirement change → affected Gherkin, UX, ticket, components, API, tests,
docs, release notes. Impact proposal + human approval.

## 16. UX / design phase

After acceptance: proposed UX based on existing patterns. Current vs
Proposed comparison. Clickable UX. Human approval before dev.

## 17. Build orchestration

Build context: ticket + requirements + Gherkin + architecture + files +
UX + rules + dependencies + QA scenarios + constraints. Passed to a coding
agent via a `CodingAgentProvider` abstraction. Initial: Claude Code.

## 18. AI model configuration

Users connect provider, select models, assign per-agent (BA, UX, QA,
Impact). Model routing. Cheaper models for classification/extraction;
stronger for senior BA reasoning. Record provider/model used.

## 19. GitHub build flow

Create branch → build context → coding agent → tests + lint + types → open
PR → link to Jira → track CI → report state. **Never auto-merge** without
explicit configurable approval policy.

## 20–22. QA, Playwright, regression

QA agent: coverage, existing tests, generate missing Playwright, execute,
collect, map failures to requirements, classify failure cause. Regression
scope from changed areas. Results attached to Gherkin + ticket.

## 23. Verification gate

DONE requires: requirements accepted + implementation complete + tests
pass + regression done + QA pass + docs updated + dev verification.

## 24. Releases

Release docs: internal summary, technical changelog, user-facing notes
(simple language, no implementation details).

## 25. Project knowledge / memory

Retain decisions, requirements (incl. rejected), assumptions, risks,
dependencies, changes, releases, implementation links, QA evidence. AI
uses this context — never treats a new brief as blank.

## 26. Integrations area

GitHub, Jira, Anthropic, Playwright. Architecture supports future
integrations.

## 27–29. Security, cost control, auditability

Secret storage, encryption at rest, tenant isolation, audit logs,
least-privilege scopes. Deliberate LLM calls — index + retrieve, don't
dump the codebase. Record every important agent action: timestamp, user,
provider, model, input refs, output, resulting changes, approval status.

## 30. UI principles

Serious professional product — not a chatbot. Nav: Portfolio, Projects,
Tickets, Product, Requirements, Documentation, UX, QA, Releases,
Integrations, Settings. AI appears inside workflows (Analyze brief,
Generate requirements, Show impact, Generate UX, Prepare build, Run QA).

## 31. MVP implementation order

1. Foundation (SaaS, auth, orgs, roles, integrations framework, Jira +
   GitHub OAuth, Anthropic config).
2. Product Initialization (repo scanner, Jira ingestion, knowledge model,
   product map, C4, process flows, requirement extraction, baseline).
3. BA ticket lifecycle (ticket selection, brief intake, context retrieval,
   BA agent, questions, requirements, Gherkin, acceptance, traceability).
4. UX + build (current UX model, proposed UX, clickable prototype, build
   context, coding-agent abstraction, GitHub branch/PR flow).
5. QA (Playwright integration, QA agent, test generation, execution,
   evidence, regression, verification).
6. Living documentation (auto doc updates, impact analysis, decision
   history, release notes, product baseline/versioning).

## 33. First deliverable (vertical slice)

Org → connect Jira → connect GitHub → connect Anthropic → select Jira
project + repo → initialize app → Product Baseline → select/create one
Jira ticket → BA Agent analyses → structured requirements + Gherkin →
human accepts/rejects. Then: accepted → UX → build context → GitHub
implementation → Playwright → QA → verification → documentation → release
notes.
