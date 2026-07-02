import type { AgentContext, BrdResult, PlanResult } from "./types";

/**
 * Planner agent. Turns approved acceptance criteria into an ordered, technical
 * implementation plan and the set of files it expects to touch.
 *
 * STUB: derives a plausible plan from the criteria. Replace the body with a
 * real code-aware planner (repo read + LLM) without changing the interface.
 */
export async function runPlanner(
  ctx: AgentContext,
  brd: BrdResult
): Promise<PlanResult> {
  await ctx.log("Planner deriving implementation steps from acceptance criteria.");

  const steps = [
    "Confirm the affected area of the codebase against the acceptance criteria",
    ...brd.acceptanceCriteria.map((c, i) => `Implement change ${i + 1}: ${c}`),
    "Add or update automated tests to cover the acceptance criteria",
    "Update user-facing copy/docs if behavior changes",
  ];

  return {
    summary: `Plan covering ${brd.acceptanceCriteria.length} acceptance criteria for "${ctx.request.title}".`,
    steps,
    files: ["src/(area-to-be-resolved-by-real-planner)", "tests/(new-coverage)"],
  };
}
