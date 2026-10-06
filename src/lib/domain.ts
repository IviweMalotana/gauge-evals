/**
 * Domain string-literal types.
 *
 * SQLite has no native enums, so these columns are stored as plain strings in
 * Prisma. This module is the single source of truth for their allowed values,
 * replacing the enums we'd otherwise import from `@prisma/client`.
 */

export type Role =
  | "OWNER"
  | "ADMIN"
  | "BA"
  | "PRODUCT"
  | "DEVELOPER"
  | "QA"
  | "VIEWER"
  // Legacy — pre-expanded role set, kept so existing seeds / rows still read.
  | "COLLABORATOR"
  | "STAKEHOLDER";

export const ROLES: Role[] = [
  "OWNER",
  "ADMIN",
  "BA",
  "PRODUCT",
  "DEVELOPER",
  "QA",
  "VIEWER",
  "COLLABORATOR",
  "STAKEHOLDER",
];

export type RequestType = "UNKNOWN" | "BUG" | "FEATURE";

/**
 * Full ticket lifecycle from the product spec.
 *
 * The legacy Baton pipeline (INTAKE / UX_CHECK / BRD_DRAFTING / ...) is kept
 * so existing rows still parse; the new stages (ANALYSIS, QUESTIONS,
 * REQUIREMENTS_DRAFT, ACCEPTED, BUILD_READY, DESIGN_UX, VERIFICATION) match
 * the canonical chain in `docs/PRODUCT-SPEC.md`.
 *
 * A build cannot begin until the relevant requirements are accepted. The
 * orchestrator enforces this by refusing to transition past
 * AWAITING_APPROVAL / AWAITING_ACCEPTANCE without an ACCEPTED decision.
 */
export type RequestStatus =
  // New (spec)
  | "INTAKE"
  | "ANALYSIS"
  | "QUESTIONS"
  | "REQUIREMENTS_DRAFT"
  | "AWAITING_ACCEPTANCE"
  | "ACCEPTED"
  | "BUILD_READY"
  | "DESIGN_UX"
  | "BUILDING"
  | "QA"
  | "REGRESSION"
  | "VERIFICATION"
  | "DONE"
  // Legacy Baton statuses (still emitted by the current orchestrator)
  | "UX_CHECK"
  | "BRD_DRAFTING"
  | "AWAITING_APPROVAL"
  | "PLANNING"
  | "TESTING"
  | "BUGFIX_REVIEW"
  | "PR_CREATED"
  | "REJECTED"
  | "FAILED";

export const LIFECYCLE_ORDER: RequestStatus[] = [
  "INTAKE",
  "ANALYSIS",
  "QUESTIONS",
  "REQUIREMENTS_DRAFT",
  "AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "BUILD_READY",
  "DESIGN_UX",
  "BUILDING",
  "QA",
  "REGRESSION",
  "VERIFICATION",
  "DONE",
];

export type ApprovalDecision = "ACCEPTED" | "REJECTED" | "ALTERED";

/**
 * The agent roles that can be assigned a specific provider:model via
 * `Company.modelRouting`. Keep this list in sync with the model-routing UI.
 */
export type AgentRole =
  | "ba"
  | "ux"
  | "qa"
  | "impact"
  | "questions"
  | "release";

export const AGENT_ROLES: AgentRole[] = [
  "ba",
  "ux",
  "qa",
  "impact",
  "questions",
  "release",
];

export type ClarifyingQuestionState = "open" | "answered" | "dismissed";

export type ReleaseAudience = "user" | "technical" | "internal";

export type EvidenceConfidence =
  | "observed"
  | "inferred"
  | "unknown"
  | "confirmed";
