import { completeJson, getAnthropic } from "../anthropic";
import { env, features } from "../env";
import {
  forceBranch,
  getDefaultBranch,
  getFile,
  getTree,
  putFile,
  type GhClient,
} from "../github";
import { APP_NAME, BRANCH_PREFIX } from "../brand";
import type { AgentContext, BrdResult, BuildResult, PlanResult } from "./types";

/**
 * Builder agent — GROUNDED in the real repo.
 *
 * When a GitHub repo + token are connected and an API key is set, it performs a
 * real build in three grounded steps:
 *   1. List the repo's actual source files (git tree).
 *   2. Ask Claude to pick which existing files the change lives in; read them.
 *   3. Ask Claude for the concrete file changes and commit them to the branch.
 *
 * The branch is force-reset to the base at the start of every build, so reruns
 * start clean instead of stacking on a previous attempt's commits. Proposed
 * paths are validated against the real tree — editing a file that doesn't
 * exist is only allowed as an explicit new file, and is logged as such.
 */

const PICK_SYSTEM = `You are a senior engineer locating where a change should be made in an
existing codebase. You are given the request, the plan, and the repository's
actual file list. Choose the files (max 5) most likely to need reading/editing.
Only choose paths that appear in the provided file list — never invent paths.
Reply with a single JSON object only: { "files": string[] }`;

const BUILD_SYSTEM = `You are a senior software engineer implementing an approved change in an
existing codebase. You are given the plan, acceptance criteria, the repository's
file list, and the current contents of the most relevant files.

Produce the MINIMAL set of file changes that satisfies the acceptance criteria,
consistent with the existing code's style and conventions.
- STRONGLY prefer editing the provided existing files.
- Only create a new file if the change genuinely requires one; if you do, its
  path must fit the repository's existing structure (see the file list).
- Never touch unrelated code.

Reply with a single JSON object only, matching exactly this shape:
{
  "summary": string,                      // what you changed, in 1-3 sentences
  "files": [ { "path": string, "contents": string } ]  // FULL new content per file
}
Include at most 6 files. "contents" must be the complete file, not a diff.`;

const MAX_TREE_PATHS = 400;
const MAX_CONTEXT_FILES = 5;
const MAX_CHANGED_FILES = 6;

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|css|scss|html|json|prisma|md|py|rb|go|rs|java|vue|svelte)$/i;
const EXCLUDED = /^(node_modules|\.next|dist|build|coverage|public\/artifacts)\/|package-lock\.json$/;

export async function runBuilder(
  ctx: AgentContext,
  plan: PlanResult,
  brd: BrdResult
): Promise<BuildResult> {
  const branch = `${BRANCH_PREFIX}/${ctx.request.id.slice(0, 8)}`;

  const canBuildForReal = Boolean(ctx.githubToken && ctx.repo && features.anthropic && getAnthropic());
  if (canBuildForReal) {
    try {
      return await realBuild(ctx, plan, brd, branch);
    } catch (err) {
      await ctx.log(`Real build failed (${(err as Error).message}); falling back to stub.`);
    }
  } else {
    await ctx.log(
      "Builder running as a stub — needs a connected GitHub repo + ANTHROPIC_API_KEY to write real code."
    );
  }
  return stubBuild(ctx, branch);
}

async function realBuild(
  ctx: AgentContext,
  plan: PlanResult,
  brd: BrdResult,
  branch: string
): Promise<BuildResult> {
  const client: GhClient = { token: ctx.githubToken!, repo: ctx.repo! };
  await ctx.log(`Builder working on ${ctx.repo} branch ${branch}.`);

  // Start every build from a clean base — reruns must not inherit junk commits.
  const { base, baseSha } = await getDefaultBranch(client);
  await forceBranch(client, branch, baseSha);

  // Ground in the repo's REAL file list.
  const { entries, truncated } = await getTree(client, base);
  const sourceFiles = entries
    .filter((e) => e.type === "blob" && SOURCE_EXT.test(e.path) && !EXCLUDED.test(e.path))
    .map((e) => e.path);
  const treeList = prioritize(sourceFiles).slice(0, MAX_TREE_PATHS);
  await ctx.log(
    `Repo tree: ${sourceFiles.length} source file(s)${truncated ? " (tree truncated by GitHub)" : ""}.`
  );

  const requestBlock = `Request: ${ctx.request.title}
${ctx.request.description}

Acceptance criteria:
${brd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Plan:
${plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

  // Step 1: pick the real files to read (planner guesses are only a hint).
  const pick = await completeJson({
    system: PICK_SYSTEM,
    user: `${requestBlock}

Planner's guesses (may be wrong): ${plan.files.join(", ") || "(none)"}

Repository file list:
${treeList.join("\n")}

Return the files to read as JSON.`,
    maxTokens: 400,
  });
  let chosen = (Array.isArray(pick.files) ? pick.files.map(String) : [])
    .filter((p) => sourceFiles.includes(p))
    .slice(0, MAX_CONTEXT_FILES);
  if (chosen.length === 0) {
    chosen = plan.files.filter((p) => sourceFiles.includes(p)).slice(0, MAX_CONTEXT_FILES);
  }

  const context: { path: string; contents: string }[] = [];
  for (const path of chosen) {
    const file = await getFile(client, path, base);
    if (file) context.push({ path, contents: file.contents });
  }
  await ctx.log(`Read ${context.length} file(s) for context.`, {
    files: context.map((f) => f.path),
  });

  // Step 2: generate the concrete changes, grounded in tree + real contents.
  const json = await completeJson({
    system: BUILD_SYSTEM,
    user: `${requestBlock}

Repository file list:
${treeList.join("\n")}

Current contents of the relevant files${context.length ? ":" : " — none could be read; be conservative."}
${context.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Return the file changes as JSON.`,
    maxTokens: 4000,
  });

  const raw = Array.isArray(json.files)
    ? (json.files as unknown[])
        .map((f) => f as { path?: unknown; contents?: unknown })
        .filter((f) => typeof f.path === "string" && typeof f.contents === "string")
        .map((f) => ({ path: String(f.path), contents: String(f.contents) }))
    : [];
  const { accepted: proposed, rejected } = filterProposedFiles(raw, sourceFiles);
  if (rejected.length > 0) {
    await ctx.log(`Rejected ${rejected.length} unsafe proposed path(s).`, { rejected });
  }
  if (proposed.length === 0) {
    throw new Error(
      raw.length === 0
        ? "Model proposed no file changes"
        : `All proposed paths were rejected as unsafe: ${raw.map((f) => f.path).join(", ")}`
    );
  }

  // Validate against the real tree; new files are allowed but called out.
  const newFiles = proposed.filter((f) => !sourceFiles.includes(f.path)).map((f) => f.path);
  if (newFiles.length > 0) {
    await ctx.log(`Builder is creating ${newFiles.length} NEW file(s).`, { newFiles });
  }
  if (newFiles.length === proposed.length && context.length > 0) {
    // Everything "new" while real files were readable smells like hallucinated
    // paths — refuse rather than commit junk.
    throw new Error(
      `All proposed paths are new despite existing context (${newFiles.join(", ")}) — likely ungrounded`
    );
  }

  for (const f of proposed) {
    const existing = await getFile(client, f.path, branch);
    await putFile(client, {
      filePath: f.path,
      contents: f.contents,
      message: `${APP_NAME} build: ${ctx.request.title} (${f.path})`,
      branch,
      sha: existing?.sha,
    });
  }
  const changed = proposed.map((f) => f.path);
  await ctx.log(`Committed ${changed.length} file(s) to ${branch}.`, { files: changed });

  const summary = String(json.summary ?? "").trim() || `Implemented "${ctx.request.title}".`;
  const diff = [
    `Committed ${changed.length} file(s) to \`${branch}\` (by ${env.ANTHROPIC_MODEL}):`,
    ...changed.map((p) => `- ${p}`),
    "",
    summary,
  ].join("\n");

  return { branch, summary, diff, committed: true, filesChanged: changed };
}

/**
 * Validate proposed file paths against the REAL repo tree.
 *
 * A path that exists in the tree is always acceptable — including Next.js
 * route-group paths like `src/app/(auth)/login/page.tsx` (an earlier regex
 * guard rejected any parentheses and silently discarded correct edits).
 * A new path is acceptable only if it looks like a sane relative repo path.
 */
export function filterProposedFiles(
  proposed: { path: string; contents: string }[],
  sourceFiles: string[]
): { accepted: { path: string; contents: string }[]; rejected: string[] } {
  const existing = new Set(sourceFiles);
  const saneNewPath = (p: string) =>
    !/\s/.test(p) &&
    !p.includes("..") &&
    !p.startsWith("/") &&
    /^[\w\-./()[\]@]+$/.test(p) &&
    /\.[a-z0-9]+$/i.test(p.split("/").pop() ?? ""); // real files have extensions

  const accepted: { path: string; contents: string }[] = [];
  const rejected: string[] = [];
  for (const f of proposed) {
    if (existing.has(f.path) || saneNewPath(f.path)) accepted.push(f);
    else rejected.push(f.path);
  }
  return { accepted: accepted.slice(0, MAX_CHANGED_FILES), rejected };
}

/** Put likely-app code first so a capped list keeps the important paths. */
function prioritize(paths: string[]): string[] {
  const score = (p: string) =>
    p.startsWith("src/") || p.startsWith("app/") || p.startsWith("pages/")
      ? 0
      : p.startsWith("lib/") || p.startsWith("components/")
        ? 1
        : 2;
  return [...paths].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

function stubBuild(ctx: AgentContext, branch: string): BuildResult {
  const diff = `diff --git a/CHANGES.md b/CHANGES.md
new file mode 100644
--- /dev/null
+++ b/CHANGES.md
@@ -0,0 +1,3 @@
+# ${ctx.request.title}
+
+Implemented per approved acceptance criteria (builder stub).`;
  return {
    branch,
    summary: `Applied the plan on ${branch}. (Builder stub — no real code changes.)`,
    diff,
    committed: false,
    filesChanged: [],
  };
}
