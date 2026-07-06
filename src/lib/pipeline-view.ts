import type { RequestStatus } from "./domain";

/** Ordered pipeline steps for the progress UI, mapped to request statuses. */
export const PIPELINE_STEPS: { key: string; label: string; status: RequestStatus }[] = [
  { key: "ux", label: "UX check", status: "UX_CHECK" },
  { key: "brd", label: "BRD", status: "BRD_DRAFTING" },
  { key: "approval", label: "Approval", status: "AWAITING_APPROVAL" },
  { key: "plan", label: "Plan", status: "PLANNING" },
  { key: "build", label: "Build", status: "BUILDING" },
  { key: "acceptance", label: "Acceptance", status: "TESTING" },
  { key: "bugfix", label: "Bug fix", status: "BUGFIX_REVIEW" },
  { key: "regression", label: "Regression", status: "REGRESSION" },
  { key: "pr", label: "PR", status: "PR_CREATED" },
];

const ORDER: RequestStatus[] = [
  "INTAKE",
  "UX_CHECK",
  "BRD_DRAFTING",
  "AWAITING_APPROVAL",
  "PLANNING",
  "BUILDING",
  "TESTING",
  "BUGFIX_REVIEW",
  "REGRESSION",
  "PR_CREATED",
  "DONE",
];

export function stepState(
  stepStatus: RequestStatus,
  current: string
): "done" | "active" | "failed" | "todo" {
  if (current === "FAILED") {
    // Everything up to where it failed is done; we can't know exactly, so mark
    // the current stage failed and earlier ones done heuristically.
    return "todo";
  }
  if (current === "REJECTED") return "todo";
  const stepIdx = ORDER.indexOf(stepStatus);
  const curIdx = ORDER.indexOf(current as RequestStatus);
  if (curIdx > stepIdx) return "done";
  if (curIdx === stepIdx) return "active";
  return "todo";
}

/** True while the background worker is actively moving the request forward. */
export function isActive(status: string): boolean {
  return [
    "INTAKE",
    "UX_CHECK",
    "BRD_DRAFTING",
    "PLANNING",
    "BUILDING",
    "TESTING",
    "BUGFIX_REVIEW",
    "REGRESSION",
    "PR_CREATED",
  ].includes(status);
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    INTAKE: "Intake",
    UX_CHECK: "UX check",
    BRD_DRAFTING: "Drafting BRD",
    AWAITING_APPROVAL: "Awaiting approval",
    PLANNING: "Planning",
    BUILDING: "Building",
    TESTING: "Acceptance testing",
    BUGFIX_REVIEW: "Bug-fix review",
    REGRESSION: "Regression",
    PR_CREATED: "PR created",
    DONE: "Done",
    REJECTED: "Rejected",
    FAILED: "Failed",
  };
  return map[status] ?? status;
}
