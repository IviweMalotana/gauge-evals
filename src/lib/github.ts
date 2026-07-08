/**
 * Minimal GitHub REST client for the pipeline. No SDK — just the handful of
 * calls the builder and PR agents need, exposed as small composable operations.
 */

const API = "https://api.github.com";

export interface GhClient {
  token: string;
  repo: string; // "owner/name"
}

async function gh<T>(
  c: GhClient,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${c.token}`,
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

/** The repo's default branch name and its head commit sha. */
export async function getDefaultBranch(
  c: GhClient
): Promise<{ base: string; baseSha: string }> {
  const repoInfo = await gh<{ default_branch: string }>(c, "GET", `/repos/${c.repo}`);
  const base = repoInfo.default_branch;
  const ref = await gh<{ object: { sha: string } }>(
    c,
    "GET",
    `/repos/${c.repo}/git/ref/heads/${encodeURIComponent(base)}`
  );
  return { base, baseSha: ref.object.sha };
}

/** Create `branch` at `sha` if it doesn't already exist. */
export async function ensureBranch(
  c: GhClient,
  branch: string,
  sha: string
): Promise<void> {
  try {
    await gh(c, "POST", `/repos/${c.repo}/git/refs`, {
      ref: `refs/heads/${branch}`,
      sha,
    });
  } catch (err) {
    if (!String(err).includes("Reference already exists")) throw err;
  }
}

/** Fetch a file's text + blob sha at a ref, or null if it doesn't exist. */
export async function getFile(
  c: GhClient,
  filePath: string,
  ref: string
): Promise<{ contents: string; sha: string } | null> {
  try {
    const res = await gh<{ content: string; encoding: string; sha: string }>(
      c,
      "GET",
      `/repos/${c.repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(ref)}`
    );
    const contents =
      res.encoding === "base64"
        ? Buffer.from(res.content, "base64").toString("utf8")
        : res.content;
    return { contents, sha: res.sha };
  } catch (err) {
    if (String(err).includes("→ 404")) return null;
    throw err;
  }
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
}

/**
 * List every path in the repo at a ref (recursive). Used to discover
 * requirement files and to learn the codebase structure. `truncated` is true
 * when GitHub caps the response for very large repos.
 */
export async function getTree(
  c: GhClient,
  ref: string
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const res = await gh<{ tree: TreeEntry[]; truncated: boolean }>(
    c,
    "GET",
    `/repos/${c.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  );
  return { entries: res.tree ?? [], truncated: Boolean(res.truncated) };
}

/** List the entries directly under a directory at a ref (empty if missing). */
export async function listDir(
  c: GhClient,
  dirPath: string,
  ref: string
): Promise<{ path: string; name: string; type: "file" | "dir"; sha: string }[]> {
  try {
    const res = await gh<
      { path: string; name: string; type: "file" | "dir"; sha: string }[]
    >(c, "GET", `/repos/${c.repo}/contents/${encodePath(dirPath)}?ref=${encodeURIComponent(ref)}`);
    return Array.isArray(res) ? res : [];
  } catch (err) {
    if (String(err).includes("→ 404")) return [];
    throw err;
  }
}

/** Create or update a file on a branch. */
export async function putFile(
  c: GhClient,
  args: { filePath: string; contents: string; message: string; branch: string; sha?: string }
): Promise<void> {
  await gh(c, "PUT", `/repos/${c.repo}/contents/${encodePath(args.filePath)}`, {
    message: args.message,
    content: Buffer.from(args.contents, "utf8").toString("base64"),
    branch: args.branch,
    sha: args.sha,
  });
}

export interface OpenedPr {
  number: number;
  url: string;
}

/** Open a pull request for an existing branch. */
export async function createPr(
  c: GhClient,
  args: { title: string; head: string; base: string; body: string }
): Promise<OpenedPr> {
  const pr = await gh<{ number: number; html_url: string }>(c, "POST", `/repos/${c.repo}/pulls`, {
    title: args.title,
    head: args.head,
    base: args.base,
    body: args.body,
  });
  return { number: pr.number, url: pr.html_url };
}

/** Encode a repo file path for the contents API (keep slashes). */
function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

/**
 * Convenience used by the PR-agent fallback: create a branch off default,
 * commit a single file, and open a PR. (When the builder has already committed
 * real code, the PR agent opens the PR directly instead.)
 */
export async function openPrWithFile(args: {
  token: string;
  repo: string;
  branch: string;
  filePath: string;
  fileContents: string;
  commitMessage: string;
  prTitle: string;
  prBody: string;
}): Promise<OpenedPr> {
  const c: GhClient = { token: args.token, repo: args.repo };
  const { base, baseSha } = await getDefaultBranch(c);
  await ensureBranch(c, args.branch, baseSha);
  const existing = await getFile(c, args.filePath, args.branch);
  await putFile(c, {
    filePath: args.filePath,
    contents: args.fileContents,
    message: args.commitMessage,
    branch: args.branch,
    sha: existing?.sha,
  });
  return createPr(c, { title: args.prTitle, head: args.branch, base, body: args.prBody });
}
