import type { AgentContext, BuildResult, PrResult } from "./types";

/**
 * PR agent. Opens a pull request for the build against the company's connected
 * repo.
 *
 * STUB: synthesizes a PR URL. When a real GitHub token + repo are connected,
 * replace the body with a real `POST /repos/{owner}/{repo}/pulls` call using
 * the company's stored access token.
 */
export async function runPr(
  ctx: AgentContext,
  build: BuildResult
): Promise<PrResult> {
  const repo = ctx.repo ?? "your-org/your-repo";
  const title = `[Gauge] ${ctx.request.title}`;
  await ctx.log(`Opening pull request against ${repo}.`);

  // TODO(github): create a real PR with the stored company access token.
  const url = `https://github.com/${repo}/compare/${build.branch}?expand=1`;

  return { number: null, url, title };
}
