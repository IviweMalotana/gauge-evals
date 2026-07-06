import { completeJson, getAnthropic } from "../anthropic";
import { env, features } from "../env";
import {
  ensureBranch,
  getDefaultBranch,
  getFile,
  putFile,
  type GhClient,
} from "../github";
import { APP_NAME, BRANCH_PREFIX } from "../brand";
import type { AgentContext, BrdResult, BuildResult, PlanResult } from "./types";

/**
 * Builder agent.
 *
 * When a GitHub repo + token are connected and an API key is set, this performs
 * a REAL build: it creates the branch, reads the plan's target files from the
 * repo, asks Claude for concrete file changes that satisfy the acceptance
 * criteria, and commits them to the branch. The PR agent then opens a PR for
 * the branch, which a human reviews before anything merges.
 *
 * Without a repo/token/key it falls back to a stub (synthetic branch + diff, no
 * commits) so the pipeline still completes in a demo.
 */

const SYSTEM = `You are a senior software engineer implementing an approved change in an
existing codebase. You are given a plan, acceptance criteria, and the current
contents of the files most likely to be involved.

Produce the MINIMAL set of file changes that satisfies the acceptance criteria,
consistent with the existing code's style and conventions. Prefer editing
existing files over adding new ones. Do not touch unrelated code.

Reply with a single JSON object only, matching exactly this shape:
{
  "summary": string,                      // what you changed, in 1-3 sentences
  "files": [ { "path": string, "contents": string } ]  // FULL new content per file
}
Include at most 6 files. "contents" must be the complete file, not a diff.`;

// Cap how much we fetch/commit to keep a single build bounded.
const MAX_CONTEXT_FILES = 8;
const MAX_CHANGED_FILES = 6;

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

  // Create the branch off the repo's default branch.
  const { base, baseSha } = await getDefaultBranch(client);
  await ensureBranch(client, branch, baseSha);

  // Gather context: current contents of the plan's real-looking target files.
  const candidates = plan.files
    .filter((p) => p && !/[()]|\s|\.\.\./.test(p)) // drop planner placeholders
    .slice(0, MAX_CONTEXT_FILES);
  const context: { path: string; contents: string }[] = [];
  for (const path of candidates) {
    const file = await getFile(client, path, base);
    if (file) context.push({ path, contents: file.contents });
  }
  await ctx.log(`Read ${context.length} file(s) for context.`, {
    files: context.map((f) => f.path),
  });

  // Ask Claude for concrete changes.
  const userPrompt = `Request: ${ctx.request.title}
${ctx.request.description}

Acceptance criteria:
${brd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Plan:
${plan.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Current contents of likely-relevant files${context.length ? ":" : " — none were found in the repo."}
${context.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Return the file changes as JSON.`;

  const json = await completeJson({ system: SYSTEM, user: userPrompt, maxTokens: 4000 });
  const files = Array.isArray(json.files)
    ? (json.files as unknown[])
        .map((f) => f as { path?: unknown; contents?: unknown })
        .filter((f) => typeof f.path === "string" && typeof f.contents === "string")
        .map((f) => ({ path: String(f.path), contents: String(f.contents) }))
        .filter((f) => !/[()]|\.\.\./.test(f.path)) // never commit placeholder paths
        .slice(0, MAX_CHANGED_FILES)
    : [];

  if (files.length === 0) {
    throw new Error("Model proposed no file changes");
  }

  // Commit each file to the branch.
  for (const f of files) {
    const existing = await getFile(client, f.path, branch);
    await putFile(client, {
      filePath: f.path,
      contents: f.contents,
      message: `${APP_NAME} build: ${ctx.request.title} (${f.path})`,
      branch,
      sha: existing?.sha,
    });
  }
  const changed = files.map((f) => f.path);
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
