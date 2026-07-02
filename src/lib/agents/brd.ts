import { completeJson, getAnthropic } from "../anthropic";
import { env, features } from "../env";
import type { AgentContext, BrdResult, UxCheckResult } from "./types";

/**
 * BRD agent.
 *
 * Turns a request (plus the UX-check finding) into a Business Requirements
 * Document written in a Business-Analyst / UX voice — Given/When/Then Gherkin,
 * no dev-heavy jargon — and a list of acceptance criteria.
 *
 * Uses the real Anthropic API when ANTHROPIC_API_KEY is set. Falls back to a
 * deterministic template so the pipeline still runs end-to-end without a key.
 */

const SYSTEM = `You are a senior Business Analyst who writes crisp, business-facing requirements.
You write for stakeholders and designers, NOT engineers. Avoid technical/dev jargon
(no mention of functions, endpoints, databases, frameworks). Focus on user-observable
behavior and business value.

You always produce Gherkin using Feature / Scenario / Given / When / Then, phrased in
plain language a non-technical stakeholder can validate.

Reply with a single JSON object only, matching exactly this shape:
{
  "narrative": string,            // 2-4 short paragraphs, plain language
  "gherkin": string,              // one Feature with 1-3 Scenarios, Given/When/Then
  "acceptanceCriteria": string[]  // 3-6 concise, testable, user-facing bullets
}`;

export async function runBrd(
  ctx: AgentContext,
  uxCheck: UxCheckResult
): Promise<BrdResult> {
  const { title, description, type } = ctx.request;

  const userPrompt = `Request type: ${type}
Title: ${title}

Stakeholder description:
${description}

UX-check finding:
${uxCheck.summary}
${uxCheck.reproduced ? "(The issue was reproduced.)" : ""}

Write the BRD as JSON.`;

  if (!features.anthropic || !getAnthropic()) {
    await ctx.log("ANTHROPIC_API_KEY not set — using deterministic BRD template.");
    return fallbackBrd(ctx, uxCheck);
  }

  try {
    const json = await completeJson({ system: SYSTEM, user: userPrompt, maxTokens: 2000 });
    const result: BrdResult = {
      narrative: String(json.narrative ?? "").trim(),
      gherkin: String(json.gherkin ?? "").trim(),
      acceptanceCriteria: Array.isArray(json.acceptanceCriteria)
        ? json.acceptanceCriteria.map(String)
        : [],
      model: env.ANTHROPIC_MODEL,
    };
    if (!result.narrative || !result.gherkin || result.acceptanceCriteria.length === 0) {
      throw new Error("Model returned an incomplete BRD");
    }
    await ctx.log(`BRD drafted by ${env.ANTHROPIC_MODEL}.`, {
      criteria: result.acceptanceCriteria.length,
    });
    return result;
  } catch (err) {
    await ctx.log(
      `BRD agent fell back to template after model error: ${(err as Error).message}`,
      undefined
    );
    return fallbackBrd(ctx, uxCheck);
  }
}

/** Deterministic BRD so the pipeline is demoable with no API key. */
function fallbackBrd(ctx: AgentContext, uxCheck: UxCheckResult): BrdResult {
  const { title, description } = ctx.request;
  const isBug = uxCheck.classifiedType === "BUG";
  const feature = title.replace(/[\r\n]+/g, " ").slice(0, 80);

  const narrative = isBug
    ? `Stakeholders reported that "${feature}" is not behaving as expected. ${description} This document captures the expected experience so the fix can be validated by a non-technical reviewer.`
    : `Stakeholders would like "${feature}". ${description} This document describes the desired experience in business terms so it can be reviewed and approved before any work begins.`;

  const gherkin = isBug
    ? `Feature: ${feature}\n\n  Scenario: The reported problem no longer occurs\n    Given a user is using the product as described\n    When they follow the steps that previously failed\n    Then the product behaves correctly and the error does not appear`
    : `Feature: ${feature}\n\n  Scenario: The new capability is available to the user\n    Given a user with permission to use this area\n    When they perform the newly requested action\n    Then they see the expected outcome and can complete their goal`;

  const acceptanceCriteria = isBug
    ? [
        "The previously failing flow completes successfully.",
        "No error message or broken state is shown to the user.",
        "The correct result is visible and matches expectations.",
      ]
    : [
        "The requested action is discoverable in the relevant area.",
        "Completing the action produces the expected outcome.",
        "The experience is clear to a first-time user without instructions.",
      ];

  return { narrative, gherkin, acceptanceCriteria, model: "template-fallback" };
}
