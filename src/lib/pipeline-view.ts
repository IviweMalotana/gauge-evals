import type { RequestStatus } from "./domain";

/** Ordered pipeline steps for the progress UI, mapped to request statuses. */
export const PIPELINE_STEPS: { key: string; label: string; status: RequestStatus }[] = [
  { key: "ux", label: "UX check", status: "UX_CHECK" },
  { key: "brd", label: "BRD", status: "BRD_DRAFTING" },
  { key: "approval", label: "Approval", status: "AWAITING_APPROVAL" },
  { key: "plan", label: "Plan", status: "PLANNING" },
  { key: "build", label: "Build", status: "BUILDING" },
  { key: "test", label: "Test", status: "TESTING" },
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
    TESTING: "Testing",
    PR_CREATED: "PR created",
    DONE: "Done",
    REJECTED: "Rejected",
    FAILED: "Failed",
  };
  return map[status] ?? status;
}
