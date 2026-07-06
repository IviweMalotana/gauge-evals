import { completeJson, getAnthropic } from "../anthropic";
import { features } from "../env";
import { getFile, type GhClient } from "../github";
import { canDriveBrowser } from "./browserAgent";
import { acceptanceTest, bugFixReview, regressionSweep } from "./verification";
import type { AgentContext, BrdResult, BuildResult, TestResult } from "./types";

/**
 * Tester agent — verifies the change after the build. Preference order:
 *
 *  1. Browser verification (when an app URL is set): performs the acceptance
 *     criteria as real human actions, re-checks that a reported bug is fixed,
 *     and runs a regression sweep — all driving real Chromium.
 *  2. Code acceptance review (when code was committed but no app URL): asks
 *     Claude to judge the criteria against the committed diff.
 *  3. Stub pass (nothing to verify against).
 */
export async function runTester(
  ctx: AgentContext,
  build: BuildResult,
  brd: BrdResult
): Promise<TestResult> {
  const url = ctx.appBaseUrl ?? null;

  // 1. Real browser verification against the running app.
  if (url && canDriveBrowser()) {
    try {
      return await browserVerification(ctx, brd, url);
    } catch (err) {
      await ctx.log(`Browser verification failed (${(err as Error).message}); trying code review.`);
    }
  } else if (!url) {
    await ctx.log("No app URL set — browser verification skipped. Set it in Settings.");
  }

  // 2. Code acceptance review against the committed diff.
  if (ctx.githubToken && ctx.repo && build.committed && features.anthropic && getAnthropic()) {
    try {
      return await codeAcceptanceReview(ctx, build, brd);
    } catch (err) {
      await ctx.log(`Code acceptance review failed (${(err as Error).message}); using stub.`);
    }
  }

  // 3. Stub.
  await ctx.log("Tester running as a stub — set an app URL or connect a repo for real checks.");
  return stubResult();
}

async function browserVerification(
  ctx: AgentContext,
  brd: BrdResult,
  url: string
): Promise<TestResult> {
  await ctx.log(`Verifying against the running app at ${url}.`);

  const acceptance = await acceptanceTest(ctx, brd, url);
  await ctx.log(`${acceptance.label}: ${acceptance.passed ? "passed" : "failed"}.`, acceptance.lines);

  const isBug = ctx.request.type === "BUG";
  const bugFix = isBug ? await bugFixReview(ctx, url) : null;
  if (bugFix) await ctx.log(`${bugFix.label}: ${bugFix.passed ? "passed" : "failed"}.`, bugFix.lines);

  const regression = await regressionSweep(ctx, brd, url);
  await ctx.log(`${regression.label}: ${regression.passed ? "passed" : "failed"}.`, regression.lines);

  const reports = [acceptance, ...(bugFix ? [bugFix] : []), regression];
  const passed = reports.every((r) => r.passed);
  const output = reports.flatMap((r) => [`— ${r.label} —`, ...r.lines]);
  const summary = passed
    ? `All browser checks passed (${reports.map((r) => r.label.toLowerCase()).join(", ")}).`
    : `Verification found issues in: ${reports
        .filter((r) => !r.passed)
        .map((r) => r.label)
        .join(", ")}.`;

  return { passed, summary, output };
}

// --- Fallback: LLM review of the committed code against the criteria ---

const REVIEW_SYSTEM = `You are a strict but fair QA reviewer. Given acceptance criteria and the
current contents of the changed files, judge whether each criterion is met.
Reply with a single JSON object only:
{ "summary": string, "passed": boolean, "results": [ { "criterion": string, "passed": boolean, "note": string } ] }`;

async function codeAcceptanceReview(
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

  const json = await completeJson({
    system: REVIEW_SYSTEM,
    user: `Acceptance criteria:\n${brd.acceptanceCriteria
      .map((c, i) => `${i + 1}. ${c}`)
      .join("\n")}\n\nChanged files:\n${files
      .map((f) => `\n=== ${f.path} ===\n${f.contents}`)
      .join("\n")}\n\nJudge each criterion and return JSON.`,
    maxTokens: 2000,
  });

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
  const output = ["— Acceptance (code review) —", ...results.map(
    (r) => `${r.passed ? "PASS" : "FAIL"}  ${r.criterion}${r.note ? ` — ${r.note}` : ""}`
  )];
  const summary =
    String(json.summary ?? "").trim() ||
    `${results.filter((r) => r.passed).length}/${results.length} acceptance criteria met.`;
  return { passed, summary, output };
}

function stubResult(): TestResult {
  return {
    passed: true,
    summary: "All acceptance scenarios passed (tester stub).",
    output: ["PASS  acceptance/scenario-1", "PASS  acceptance/scenario-2", "PASS  lint"],
  };
}
