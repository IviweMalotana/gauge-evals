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

/** List the repos the connected account can push to (for the repo picker). */
export async function listUserRepos(token: string): Promise<{ fullName: string; private: boolean }[]> {
  const c: GhClient = { token, repo: "" };
  const res = await gh<{ full_name: string; private: boolean; permissions?: { push?: boolean } }[]>(
    c,
    "GET",
    `/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`
  );
  return (Array.isArray(res) ? res : [])
    .filter((r) => r.permissions?.push !== false)
    .map((r) => ({ fullName: r.full_name, private: r.private }));
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

/** The head commit sha of a branch, or null if the branch doesn't exist. */
export async function getBranchSha(c: GhClient, branch: string): Promise<string | null> {
  try {
    const ref = await gh<{ object: { sha: string } }>(
      c,
      "GET",
      `/repos/${c.repo}/git/ref/heads/${encodeURIComponent(branch)}`
    );
    return ref.object.sha;
  } catch (err) {
    if (String(err).includes("→ 404")) return null;
    throw err;
  }
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

/**
 * Point `branch` at `sha`, creating it if needed and force-resetting it if it
 * already exists. Used at the start of a build so reruns begin from a clean
 * base instead of stacking on a previous attempt's commits.
 */
export async function forceBranch(c: GhClient, branch: string, sha: string): Promise<void> {
  try {
    await gh(c, "POST", `/repos/${c.repo}/git/refs`, { ref: `refs/heads/${branch}`, sha });
  } catch (err) {
    if (!String(err).includes("Reference already exists")) throw err;
    await gh(c, "PATCH", `/repos/${c.repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      sha,
      force: true,
    });
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

export interface DiffFile {
  filename: string;
  status: string; // added | modified | removed | renamed
  additions: number;
  deletions: number;
  patch?: string; // unified diff (omitted by GitHub for very large/binary files)
}

/**
 * The diff of `head` relative to `base` (3-dot, i.e. what a PR would show) —
 * GitHub's authoritative patch per changed file. Used to review the actual
 * change instead of re-reading whole files.
 */
export async function compareCommits(
  c: GhClient,
  base: string,
  head: string
): Promise<DiffFile[]> {
  const res = await gh<{ files?: DiffFile[] }>(
    c,
    "GET",
    `/repos/${c.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
  );
  return res.files ?? [];
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

/**
 * Create ONE commit on `branch` containing all of `files`, based on `baseSha`.
 * Uses the Git Data API (blobs → tree → commit → ref) so a whole corpus lands
 * as a single clean commit instead of one commit per file. Creates the branch
 * if missing, else force-updates it to the new commit. Returns the commit sha.
 */
export async function commitFiles(
  c: GhClient,
  args: { branch: string; baseSha: string; message: string; files: { path: string; contents: string }[] }
): Promise<string> {
  const baseCommit = await gh<{ tree: { sha: string } }>(
    c,
    "GET",
    `/repos/${c.repo}/git/commits/${args.baseSha}`
  );
  const tree = await Promise.all(
    args.files.map(async (f) => {
      const blob = await gh<{ sha: string }>(c, "POST", `/repos/${c.repo}/git/blobs`, {
        content: Buffer.from(f.contents, "utf8").toString("base64"),
        encoding: "base64",
      });
      return { path: f.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
    })
  );
  const newTree = await gh<{ sha: string }>(c, "POST", `/repos/${c.repo}/git/trees`, {
    base_tree: baseCommit.tree.sha,
    tree,
  });
  const commit = await gh<{ sha: string }>(c, "POST", `/repos/${c.repo}/git/commits`, {
    message: args.message,
    tree: newTree.sha,
    parents: [args.baseSha],
  });
  try {
    await gh(c, "POST", `/repos/${c.repo}/git/refs`, {
      ref: `refs/heads/${args.branch}`,
      sha: commit.sha,
    });
  } catch (err) {
    if (!String(err).includes("Reference already exists")) throw err;
    await gh(c, "PATCH", `/repos/${c.repo}/git/refs/heads/${encodeURIComponent(args.branch)}`, {
      sha: commit.sha,
      force: true,
    });
  }
  return commit.sha;
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
