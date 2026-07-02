/**
 * Domain string-literal types.
 *
 * SQLite has no native enums, so these columns are stored as plain strings in
 * Prisma. This module is the single source of truth for their allowed values,
 * replacing the enums we'd otherwise import from `@prisma/client`.
 */

export type Role = "OWNER" | "ADMIN" | "COLLABORATOR" | "STAKEHOLDER";
export const ROLES: Role[] = ["OWNER", "ADMIN", "COLLABORATOR", "STAKEHOLDER"];

export type RequestType = "UNKNOWN" | "BUG" | "FEATURE";

export type RequestStatus =
  | "INTAKE"
  | "UX_CHECK"
  | "BRD_DRAFTING"
  | "AWAITING_APPROVAL"
  | "PLANNING"
  | "BUILDING"
  | "TESTING"
  | "PR_CREATED"
  | "DONE"
  | "REJECTED"
  | "FAILED";

export type ApprovalDecision = "ACCEPTED" | "REJECTED" | "ALTERED";
