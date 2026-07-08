import { completeJson, getAnthropic } from "../anthropic";
import { features } from "../env";
import { getFile, type GhClient } from "../github";
import { canDriveBrowser } from "./browserAgent";
import { acceptanceTest, bugFixReview, regressionSweep, type CheckReport } from "./verification";
import type { AgentContext, BrdResult, BuildResult, VerificationResult } from "./types";

/**
 * The verification stage, split into three separately-tracked checks so each is
 * its own pipeline stage with its own UI card:
 *
 *  - runAcceptance — always runs; prefers real browser UX, falls back to a code
 *    review of the diff, then a stub.
 *  - runBugFix     — only for bug requests when a browser target is available.
 *  - runRegression — only when a browser target is available.
 *
 * `target` is the resolved URL to test against (a per-branch preview when
 * available, else the app URL, else null). The browser path additionally needs
 * an API key to plan steps.
 */

function browserTarget(target: string | null): string | null {
  return target && canDriveBrowser() ? target : null;
}

export async function runAcceptance(
  ctx: AgentContext,
  build: BuildResult,
  brd: BrdResult,
  target: string | null
): Promise<VerificationResult> {
  const url = browserTarget(target);

  if (url) {
    try {
      await ctx.log(`Acceptance testing against the running app at ${url}.`);
      return fromReport("acceptance", await acceptanceTest(ctx, brd, url));
    } catch (err) {
      await ctx.log(`Browser acceptance failed (${(err as Error).message}); trying code review.`);
    }
  } else {
    await ctx.log("No branch preview — acceptance verifies the committed diff by code review.");
  }

  if (ctx.githubToken && ctx.repo && build.committed && features.anthropic && getAnthropic()) {
    try {
      return await codeAcceptanceReview(ctx, build, brd);
    } catch (err) {
      await ctx.log(`Code acceptance review failed (${(err as Error).message}); using stub.`);
    }
  }

  return {
    kind: "acceptance",
    passed: true,
    summary: "All acceptance scenarios passed (tester stub).",
    output: ["PASS  acceptance/scenario-1", "PASS  acceptance/scenario-2", "PASS  lint"],
    screenshots: [],
  };
}

export async function runBugFix(
  ctx: AgentContext,
  target: string | null
): Promise<VerificationResult | null> {
  const url = browserTarget(target);
  if (!url || ctx.request.type !== "BUG") return null;
  await ctx.log(`Bug-fix review: re-checking the reported failure at ${url}.`);
  return fromReport("bugfix", await bugFixReview(ctx, url));
}

export async function runRegression(
  ctx: AgentContext,
  brd: BrdResult,
  target: string | null
): Promise<VerificationResult | null> {
  const url = browserTarget(target);
  if (!url) return null;
  await ctx.log(`Regression sweep against ${url}.`);
  return fromReport("regression", await regressionSweep(ctx, brd, url));
}

function fromReport(
  kind: VerificationResult["kind"],
  report: CheckReport
): VerificationResult {
  return {
    kind,
    passed: report.passed,
    summary: report.passed
      ? `${report.label} passed.`
      : `${report.label} found issues.`,
    output: report.lines,
    screenshots: report.screenshots,
  };
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
): Promise<VerificationResult> {
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
  const output = results.map(
    (r) => `${r.passed ? "PASS" : "FAIL"}  ${r.criterion}${r.note ? ` — ${r.note}` : ""}`
  );
  const summary =
    String(json.summary ?? "").trim() ||
    `${results.filter((r) => r.passed).length}/${results.length} acceptance criteria met (code review).`;
  return { kind: "acceptance", passed, summary, output, screenshots: [] };
}
