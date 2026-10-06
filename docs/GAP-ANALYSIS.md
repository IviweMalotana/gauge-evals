# Gap analysis — spec vs current Baton

**Date:** 2026-10-06. **Repo:** gauge-evals (Baton).

The grid below maps each spec section to what the repo already does and what
is missing. The implementation plan at the bottom turns the gaps into a
sequenced work plan; this pass closes the top-of-list items.

## Scorecard

| # | Spec section | Status | Where it lives (or should) |
|---|---|---|---|
| 1 | Core product principle | partial | `prisma/schema.prisma` chains Request → Brd → Plan → Build → PR; needs Jira ticket + Release link stages. |
| 2 | Don't rebuild existing tools | partial | GitHub + Anthropic connected; **Jira missing**. |
| 3 | Multi-tenant | yes | `Company`, `Membership`, roles in `src/lib/domain.ts`. |
| 4 | Onboarding | partial | GitHub OAuth + repo pick exist; Jira pick + Product Initialization step **missing**. |
| 5 | Repository discovery | partial | `builder.ts` reads repo per request; **no persistent application knowledge model**. |
| 6 | Product knowledge model | **no** | Added by this pass: Project / Module / Screen / Route / Component / Entity / Api / BusinessRule / UserJourney. |
| 7 | Product baseline | **no** | Scaffold added (`src/lib/knowledge/baseline.ts`); generators (C4, BPMN, ERD, OpenAPI) are TODO. |
| 8 | Existing UX model | partial | `src/lib/agents/design.ts` + `uiFixer.ts` touch UX for one request; no persistent `Screen` corpus. Added here. |
| 9 | Project dashboard | **no** → added | `/projects` route + layout entry added. |
| 10 | Ticket lifecycle | partial → expanded | Baton's statuses map onto the fuller lifecycle; `src/lib/domain.ts` extended with `ANALYSIS`, `QUESTIONS`, `REQUIREMENTS_DRAFT`, `BUILD_READY`. |
| 11 | BA agent | partial | `brd.ts` writes requirements but does not ask clarifying questions. Added `questions.ts` stage. |
| 12 | Requirements | partial | `RequirementDoc` has status + version; impact tracked. Acceptance gate exists for the BRD; per-requirement acceptance is TODO. |
| 13 | Documentation | partial | Request has artifacts; **Project/Epic docs** absent. |
| 14 | Traceability | partial | Request ↔ Brd/Plan/Build/PR ↔ Requirements via `RequirementImpact`. Added Jira ticket link + Release link. |
| 15 | Impact analysis | yes | `src/lib/agents/impact.ts`. |
| 16 | UX / design | partial | `design.ts` compares current vs proposed; no persistent proposed-UX record. |
| 17 | Build orchestration | partial | `builder.ts` is hard-coded Claude Code; abstraction added as `CodingAgentProvider` (`src/lib/ai/coding.ts`). |
| 18 | AI model configuration | **no** → added | `src/lib/ai/providers.ts` + `ModelRouting` on Company. |
| 19 | GitHub build flow | yes | `pr.ts`. No auto-merge. |
| 20–22 | QA / Playwright / regression | partial | `tester.ts`, `verification.ts`, `browserAgent.ts`. |
| 23 | Verification gate | partial | Done requires PR; doesn't yet require docs updated. |
| 24 | Releases | **no** → added | `Release` + `ReleaseNote` models + route added. |
| 25 | Project memory | partial | `PipelineEvent` + `RequirementDoc` persist history. |
| 26 | Integrations area | partial | Settings page is single-tenant for GitHub + Anthropic. Added `/integrations` with Jira. |
| 27 | Security | partial | `crypto.ts` exists; tokens stored encrypted when `AUTH_SECRET` set. Audit log via `PipelineEvent`. |
| 28 | Cost control | partial | No embeddings/index yet; context assembly reads files per request. |
| 29 | Auditability | yes | `PipelineEvent` records every stage with model, data blob. |
| 30 | UI principles | partial → better | Sidebar now exposes Projects / Product / Releases / Integrations. |

## What this pass delivers

1. **AI provider abstraction** — `src/lib/ai/providers.ts` with an initial
   Anthropic provider and the shape future providers (OpenAI, Google) will
   implement; `ModelRouting` on `Company` lets BA / UX / QA / Impact agents
   run different models.
2. **Jira integration scaffold** — `src/lib/jira/client.ts` + `JiraConnection`
   and `JiraIssue` models; `/integrations` page shows connection + project
   picker. Linking a Baton request to a Jira issue is recorded on `Request`.
3. **Product Knowledge Model schema** — `Project`, `Module`, `Screen`,
   `Route`, `UiComponent`, `Entity`, `Api`, `BusinessRule`, `UserJourney`,
   `Decision` as first-class rows under a `Project`. One project groups a
   Jira project + a GitHub repo + a baseline.
4. **Releases** — `Release` + `ReleaseNote` models with internal /
   technical / user-facing notes; `/releases` route.
5. **Expanded ticket lifecycle** — `src/lib/domain.ts` adds `ANALYSIS`,
   `QUESTIONS`, `REQUIREMENTS_DRAFT`, `ACCEPTED`, `BUILD_READY`,
   `DESIGN_UX`, `VERIFICATION` to match the spec. `pipeline-view.ts`
   maps them.
6. **Clarifying questions stage** — `src/lib/agents/questions.ts` + a
   `ClarifyingQuestion` model so the BA agent can block on human answers
   before writing the BRD.
7. **Coding agent abstraction** — `src/lib/ai/coding.ts` wraps the current
   builder behind a `CodingAgentProvider` interface so future coding
   backends can slot in.
8. **UI nav** — Portfolio (`/projects`), Product (`/product`), Releases
   (`/releases`), Integrations (`/integrations`) exposed in the sidebar.

## Known gaps still open after this pass

- Full repository scanner for the knowledge model (currently seeded from
  evidence the builder already collects per request).
- C4 / BPMN / ERD / OpenAPI generators (schema is ready; render still TODO).
- Clickable UX prototype of the existing app.
- Per-requirement acceptance gate (only the BRD is gated today).
- Jira two-way sync (we read; writing transitions is behind a feature flag).
- Embeddings-based context retrieval for cost control.
- OpenAI / Google providers (the abstraction is there; adapters are TODO).

Each remaining item is a self-contained vertical slice that can be picked up
without re-architecture — the schema and abstractions landed in this pass
are the load-bearing pieces.
