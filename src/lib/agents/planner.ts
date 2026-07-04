import { completeJson, getAnthropic } from "../anthropic";
import { env, features } from "../env";
import type { AgentContext, BrdResult, PlanResult } from "./types";

/**
 * Planner agent.
 *
 * Turns the approved BRD + acceptance criteria into a concrete, ordered
 * technical implementation plan and the set of files it expects to touch.
 *
 * Uses the real Anthropic API when a key is set; falls back to a deterministic
 * plan derived from the acceptance criteria otherwise, so the pipeline always
 * completes.
 */

const SYSTEM = `You are a pragmatic senior engineer turning approved requirements into an
implementation plan for another engineer (or a coding agent) to execute.

Given a request and its acceptance criteria, produce a concrete, ordered plan.
Be specific and technical, but do not invent details of a codebase you cannot
see — when a location is unknown, say what to look for. Include a testing step.

Reply with a single JSON object only, matching exactly this shape:
{
  "summary": string,     // one or two sentences
  "steps": string[],     // 3-8 ordered, actionable steps
  "files": string[]      // likely files/areas to change (best-effort)
}`;

export async function runPlanner(
  ctx: AgentContext,
  brd: BrdResult
): Promise<PlanResult> {
  const { title, description, type } = ctx.request;

  const userPrompt = `Request type: ${type}
Title: ${title}

Description:
${description}

Approved acceptance criteria:
${brd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

${ctx.repo ? `Target repository: ${ctx.repo}` : ""}

Write the implementation plan as JSON.`;

  if (!features.anthropic || !getAnthropic()) {
    await ctx.log("ANTHROPIC_API_KEY not set — using deterministic plan template.");
    return fallbackPlan(ctx, brd);
  }

  try {
    const json = await completeJson({ system: SYSTEM, user: userPrompt, maxTokens: 1500 });
    const result: PlanResult = {
      summary: String(json.summary ?? "").trim(),
      steps: Array.isArray(json.steps) ? json.steps.map(String) : [],
      files: Array.isArray(json.files) ? json.files.map(String) : [],
    };
    if (!result.summary || result.steps.length === 0) {
      throw new Error("Model returned an incomplete plan");
    }
    await ctx.log(`Plan drafted by ${env.ANTHROPIC_MODEL}.`, { steps: result.steps.length });
    return result;
  } catch (err) {
    await ctx.log(`Planner fell back to template after model error: ${(err as Error).message}`);
    return fallbackPlan(ctx, brd);
  }
}

function fallbackPlan(ctx: AgentContext, brd: BrdResult): PlanResult {
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
