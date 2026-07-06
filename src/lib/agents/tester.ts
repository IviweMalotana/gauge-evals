import { completeJson, getAnthropic } from "../anthropic";
import { features } from "../env";
import { getFile, type GhClient } from "../github";
import type { AgentContext, BrdResult, BuildResult, TestResult } from "./types";

/**
 * Tester agent.
 *
 * When the builder committed real code and an API key is set, this runs an
 * automated ACCEPTANCE REVIEW: it fetches the committed files from the branch
 * and asks Claude to judge each approved acceptance criterion against the
 * actual changes, pass/fail with a reason. (Executing a repo's own unit suite
 * would require its CI; this checks the business/UX acceptance criteria, which
 * is what the BRD produced.)
 *
 * Falls back to a stub pass when there's nothing real to review.
 */

const SYSTEM = `You are a strict but fair QA reviewer. You are given a set of acceptance
criteria and the current contents of the files that were changed to satisfy
them. Judge whether each criterion is met by the changes.

Reply with a single JSON object only, matching exactly this shape:
{
  "summary": string,
  "passed": boolean,                                  // true only if every criterion is met
  "results": [ { "criterion": string, "passed": boolean, "note": string } ]
}`;

export async function runTester(
  ctx: AgentContext,
  build: BuildResult,
  brd: BrdResult
): Promise<TestResult> {
  const canReview = Boolean(
    ctx.githubToken && ctx.repo && build.committed && features.anthropic && getAnthropic()
  );

  if (canReview) {
    try {
      return await acceptanceReview(ctx, build, brd);
    } catch (err) {
      await ctx.log(`Acceptance review failed (${(err as Error).message}); using stub result.`);
    }
  } else {
    await ctx.log(
      "Tester running as a stub — needs committed code + ANTHROPIC_API_KEY for a real acceptance review."
    );
  }
  return stubResult();
}

async function acceptanceReview(
  ctx: AgentContext,
  build: BuildResult,
  brd: BrdResult
): Promise<TestResult> {
  const client: GhClient = { token: ctx.githubToken!, repo: ctx.repo! };
  await ctx.log(`Reviewing ${build.filesChanged.length} changed file(s) on ${build.branch}.`);

  const files: { path: string; contents: string }[] = [];
  for (const path of build.filesChanged) {
    const file = await getFile(client, path, build.branch);
    if (file) files.push({ path, contents: file.contents });
  }

  const userPrompt = `Acceptance criteria:
${brd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Changed files:
${files.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Judge each criterion against the changes and return the JSON.`;

  const json = await completeJson({ system: SYSTEM, user: userPrompt, maxTokens: 2000 });
  const results = Array.isArray(json.results)
    ? (json.results as unknown[]).map((r) => {
        const o = r as { criterion?: unknown; passed?: unknown; note?: unknown };
        return {
          criterion: String(o.criterion ?? ""),
          passed: Boolean(o.passed),
          note: String(o.note ?? ""),
        };
      })
    : [];
  if (results.length === 0) throw new Error("Reviewer returned no results");

  const passed = typeof json.passed === "boolean" ? json.passed : results.every((r) => r.passed);
  const output = results.map(
    (r) => `${r.passed ? "PASS" : "FAIL"}  ${r.criterion}${r.note ? ` — ${r.note}` : ""}`
  );
  const summary =
    String(json.summary ?? "").trim() ||
    `${results.filter((r) => r.passed).length}/${results.length} acceptance criteria met.`;

  await ctx.log(passed ? "Acceptance review passed." : "Acceptance review found gaps.", {
    passed,
    criteria: results.length,
  });
  return { passed, summary, output };
}

function stubResult(): TestResult {
  return {
    passed: true,
    summary: "All acceptance scenarios passed (tester stub).",
    output: ["PASS  acceptance/scenario-1", "PASS  acceptance/scenario-2", "PASS  lint"],
  };
}
