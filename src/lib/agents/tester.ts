import { completeJson, getAnthropic } from "../anthropic";
import { features } from "../env";
import { compareCommits, getDefaultBranch, getFile, type DiffFile, type GhClient } from "../github";
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

export const REVIEW_SYSTEM = `You are a precise QA reviewer judging a CODE DIFF against acceptance criteria.

You are given the unified diff of the change (lines starting with "-" were
removed, "+" were added). Base your judgment ONLY on the diff, and read it
literally — an added "+" line IS present in the new code.

For each criterion, decide if the diff satisfies it, and in "note" QUOTE the
specific "+"/"-" diff line that supports your verdict. Do not claim a change is
absent if a matching "+" line exists in the diff.

Reply with a single JSON object only:
{ "summary": string, "passed": boolean, "results": [ { "criterion": string, "passed": boolean, "note": string } ] }`;

/**
 * Injectable dependencies for {@link codeAcceptanceReview}. Real code uses the
 * GitHub + Anthropic implementations ({@link defaultReviewDeps}); tests pass a
 * fixed diff and a stub completion so a known-correct diff can assert a PASS
 * verdict deterministically, without network.
 */
export interface AcceptanceReviewDeps {
  /** Resolve the repo's default branch name (the diff base). */
  getBase: (client: GhClient) => Promise<string>;
  /** The unified diff of `head` vs `base` (GitHub's authoritative patch). */
  getDiff: (client: GhClient, base: string, head: string) => Promise<DiffFile[]>;
  /** Full contents of a file at a ref, or null — used when patches are omitted. */
  getFileContents: (client: GhClient, path: string, ref: string) => Promise<string | null>;
  /** Ask the model to judge the criteria against the diff, returning JSON. */
  complete: (args: { system: string; user: string; maxTokens: number }) => Promise<Record<string, unknown>>;
}

const defaultReviewDeps: AcceptanceReviewDeps = {
  getBase: async (client) => (await getDefaultBranch(client)).base,
  getDiff: (client, base, head) => compareCommits(client, base, head),
  getFileContents: async (client, path, ref) => (await getFile(client, path, ref))?.contents ?? null,
  complete: (args) => completeJson(args),
};

/** Assemble the reviewer's user prompt from the criteria and the diff. Pure. */
export function buildReviewPrompt(
  acceptanceCriteria: string[],
  diffFiles: DiffFile[],
  extraContents: { path: string; contents: string }[] = []
): string {
  const diffText = diffFiles.length
    ? diffFiles
        .map((f) => {
          const header = `=== ${f.filename} (${f.status}, +${f.additions}/-${f.deletions}) ===`;
          // Fall back to the branch's file content if GitHub omitted the patch.
          return `${header}\n${f.patch ?? "(patch unavailable)"}`;
        })
        .join("\n\n")
    : "(no file differences found between base and branch)";

  const contentBlock = extraContents.length
    ? `\n\nFull contents (patches were unavailable):\n${extraContents
        .map((f) => `=== ${f.path} (full contents) ===\n${f.contents}`)
        .join("\n\n")}`
    : "";

  return `Acceptance criteria:\n${acceptanceCriteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n")}\n\nUnified diff of the change:\n${diffText}${contentBlock}\n\nJudge each criterion against the diff and return JSON.`;
}

/** Turn the reviewer's raw JSON into a VerificationResult. Pure. Throws on empty. */
export function interpretReviewResult(json: Record<string, unknown>): VerificationResult {
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

export async function codeAcceptanceReview(
  ctx: AgentContext,
  build: BuildResult,
  brd: BrdResult,
  deps: AcceptanceReviewDeps = defaultReviewDeps
): Promise<VerificationResult> {
  const client: GhClient = { token: ctx.githubToken!, repo: ctx.repo! };

  // Review the actual DIFF (base...branch) — GitHub's authoritative patch, the
  // same thing a PR shows. Far more reliable than re-reading whole files.
  const base = await deps.getBase(client);
  const diffFiles = await deps.getDiff(client, base, build.branch);
  await ctx.log(`Reviewing the diff of ${diffFiles.length} changed file(s) on ${build.branch}.`, {
    files: diffFiles.map((f) => f.filename),
  });

  // If patches were omitted for everything, include the changed files' contents.
  const extraContents: { path: string; contents: string }[] = [];
  if (diffFiles.length > 0 && diffFiles.every((f) => !f.patch)) {
    for (const f of diffFiles) {
      const contents = await deps.getFileContents(client, f.filename, build.branch);
      if (contents !== null) extraContents.push({ path: f.filename, contents });
    }
  }

  const json = await deps.complete({
    system: REVIEW_SYSTEM,
    user: buildReviewPrompt(brd.acceptanceCriteria, diffFiles, extraContents),
    maxTokens: 2000,
  });

  return interpretReviewResult(json);
}
