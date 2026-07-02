import type { AgentContext, BuildResult, PlanResult } from "./types";

/**
 * Builder agent. Executes the plan against a working branch and produces a
 * diff.
 *
 * STUB: emits a synthetic branch name and a placeholder diff. Replace with a
 * real code-writing agent (e.g. an SDK sub-agent operating in a worktree)
 * without changing the interface.
 */
export async function runBuilder(
  ctx: AgentContext,
  _plan: PlanResult
): Promise<BuildResult> {
  const branch = `gauge/${ctx.request.id.slice(0, 8)}`;
  await ctx.log(`Builder working on branch ${branch}.`);

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
    summary: `Applied the plan on ${branch}. (Builder stub — no real code changes yet.)`,
    diff,
  };
}
