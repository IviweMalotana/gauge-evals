import type { AgentContext } from "./types";

/**
 * Per-branch preview URLs.
 *
 * The builder commits the change to a branch; if the company configured a
 * preview-URL template, we resolve that branch's temporary deployment URL and
 * point the browser tests at it — so acceptance / bug-fix / regression verify
 * the ACTUAL change, not the current live app. If no template is set (or the
 * preview never comes up), we fall back to the static app URL.
 *
 * The template uses placeholders:
 *   {branch}   → the build branch, URL-sanitized (e.g. gauge-ab12cd34)
 *   {repo}     → "owner/name"
 *   {repoName} → "name"
 * e.g. "https://app-{branch}.up.railway.app"
 */

/** Sanitize a git branch for use in a hostname/path (matches Vercel/Railway). */
export function slugBranch(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function buildPreviewUrl(template: string, branch: string, repo?: string | null): string {
  const repoName = repo?.split("/")[1] ?? "";
  return template
    .replace(/\{branch\}/g, slugBranch(branch))
    .replace(/\{repo\}/g, repo ?? "")
    .replace(/\{repoName\}/g, repoName)
    .replace(/\/+$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until the URL responds (server up), or the deadline passes. */
export async function waitForUrl(
  url: string,
  opts: { timeoutMs: number; onTick?: () => void }
): Promise<boolean> {
  const deadline = Date.now() + opts.timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      // Any non-5xx means a server is answering (deploy is live).
      if (res.status < 500) return true;
    } catch {
      // not reachable yet
    }
    opts.onTick?.();
    await sleep(10000);
  }
  return false;
}

export interface ResolvedTarget {
  url: string | null;
  source: "preview" | "appBaseUrl" | "none";
}

/**
 * Resolve the URL the browser tests should run against for this build. Prefers
 * a live per-branch preview; falls back to the configured app URL.
 */
export async function resolveTestTarget(
  ctx: AgentContext,
  branch: string,
  log: (msg: string) => Promise<void>
): Promise<ResolvedTarget> {
  const template = ctx.previewUrlTemplate;
  if (template) {
    const url = buildPreviewUrl(template, branch, ctx.repo);
    await log(`Waiting for the branch preview to come live at ${url}…`);
    const ready = await waitForUrl(url, { timeoutMs: 180000 });
    if (ready) {
      await log(`Preview is live — verifying the actual change at ${url}.`);
      return { url, source: "preview" };
    }
    await log("Preview did not come up in time — verifying the diff by code review instead.");
    return { url: null, source: "none" };
  }
  // No preview configured. We deliberately do NOT browser-test the production
  // app URL here: it doesn't contain the branch's change, so a browser check
  // could never pass for an unmerged change. Fall back to reviewing the
  // committed diff (code acceptance review) instead.
  await log(
    "No per-branch preview URL configured — verifying the committed diff by code review. " +
      "Set a preview URL template in Settings to run real browser checks against the change."
  );
  return { url: null, source: "none" };
}
