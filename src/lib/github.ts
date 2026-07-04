/**
 * Minimal GitHub REST client for opening pull requests with the company's
 * stored OAuth token. No SDK — just the handful of calls we need.
 */

const API = "https://api.github.com";

interface GhOpts {
  token: string;
  repo: string; // "owner/name"
}

async function gh<T>(
  opts: GhOpts,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface OpenedPr {
  number: number;
  url: string;
}

/**
 * Create `branch` off the repo's default branch, commit a single file, and open
 * a PR. Used to open a "requirements PR" carrying the approved BRD; the builder
 * will later replace the committed content with real code changes.
 */
export async function openPrWithFile(args: {
  token: string;
  repo: string; // "owner/name"
  branch: string;
  filePath: string;
  fileContents: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}): Promise<OpenedPr> {
  const [owner, name] = args.repo.split("/");
  if (!owner || !name) throw new Error(`Invalid repo "${args.repo}" (expected owner/name)`);
  const opts: GhOpts = { token: args.token, repo: args.repo };

  // 1. Resolve the default branch and its head commit sha.
  const repoInfo = await gh<{ default_branch: string }>(opts, "GET", `/repos/${args.repo}`);
  const base = repoInfo.default_branch;
  const ref = await gh<{ object: { sha: string } }>(
    opts,
    "GET",
    `/repos/${args.repo}/git/ref/heads/${encodeURIComponent(base)}`
  );
  const baseSha = ref.object.sha;

  // 2. Create the feature branch (ignore "already exists").
  try {
    await gh(opts, "POST", `/repos/${args.repo}/git/refs`, {
      ref: `refs/heads/${args.branch}`,
      sha: baseSha,
    });
  } catch (err) {
    if (!String(err).includes("Reference already exists")) throw err;
  }

  // 3. Commit the file onto the branch (create or update).
  let existingSha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(
      opts,
      "GET",
      `/repos/${args.repo}/contents/${encodeURIComponent(args.filePath)}?ref=${args.branch}`
    );
    existingSha = existing.sha;
  } catch {
    // file doesn't exist yet — fine
  }
  await gh(opts, "PUT", `/repos/${args.repo}/contents/${encodeURIComponent(args.filePath)}`, {
    message: args.commitMessage,
    content: Buffer.from(args.fileContents, "utf8").toString("base64"),
    branch: args.branch,
    sha: existingSha,
  });

  // 4. Open the pull request.
  const pr = await gh<{ number: number; html_url: string }>(
    opts,
    "POST",
    `/repos/${args.repo}/pulls`,
    { title: args.prTitle, head: args.branch, base, body: args.prBody }
  );
  return { number: pr.number, url: pr.html_url };
}
