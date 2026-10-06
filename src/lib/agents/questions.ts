/**
 * Clarifying-questions agent.
 *
 * Runs AFTER the UX check and BEFORE the BRD. A strong senior BA does not
 * silently assume; they ask. This agent reads the brief + UX finding and
 * emits a short list of concrete, answerable questions. The pipeline blocks
 * at QUESTIONS until a human answers (or dismisses) them.
 *
 * Falls back to a deterministic set so the pipeline still runs without an
 * API key.
 */

import { features, env } from "../env";
import { runAgentJson } from "../ai/providers";
import type { AgentContext, UxCheckResult } from "./types";

export interface ClarifyingQuestion {
  question: string;
  // Short rationale: WHY the BA can't move on without this.
  reason: string;
}

export interface QuestionsResult {
  questions: ClarifyingQuestion[];
  model: string;
}

const SYSTEM = `You are a senior Business Analyst preparing to write requirements.
Before you write anything, list the things you cannot answer from the brief alone
and would need the stakeholder (or product owner) to confirm. Keep it tight:
3-6 questions, each one answerable in a sentence or two, each tied to a concrete
decision you'd otherwise have to assume.

Reply with a single JSON object only, exactly:
{ "questions": [{ "question": string, "reason": string }] }`;

export async function runQuestions(
  ctx: AgentContext,
  ux: UxCheckResult,
  modelRouting: string | null | undefined
): Promise<QuestionsResult> {
  if (!features.anthropic) {
    return fallback(ctx);
  }

  const user = `Request type: ${ctx.request.type}
Title: ${ctx.request.title}

Stakeholder description:
"""
${ctx.request.description}
"""

UX-check finding:
"""
${ux.summary}
"""`;

  try {
    const parsed = await runAgentJson<{ questions: ClarifyingQuestion[] }>({
      role: "questions",
      routing: modelRouting,
      req: { system: SYSTEM, user, maxTokens: 800 },
    });
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: ClarifyingQuestion) => q && q.question).slice(0, 6)
      : [];
    return { questions, model: env.ANTHROPIC_MODEL };
  } catch {
    return fallback(ctx);
  }
}

function fallback(ctx: AgentContext): QuestionsResult {
  return {
    questions: [
      {
        question: `Who is the primary user for "${ctx.request.title}" and what is the business outcome?`,
        reason: "The BRD needs an owner and a measurable success condition.",
      },
      {
        question: "Are there existing flows or screens this must change rather than add to?",
        reason: "Avoids proposing an isolated interface that contradicts the current product.",
      },
      {
        question: "What should happen on the obvious failure paths (invalid input, no permission, offline)?",
        reason: "Error states belong in the BRD, not left to the implementation.",
      },
    ],
    model: "fallback",
  };
}
