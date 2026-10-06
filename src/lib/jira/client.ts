/**
 * Jira integration (REST v3).
 *
 * The platform must not rebuild Jira; it reads from and writes transitions
 * back to it. We ship the HTTP client + project / issue readers here; the
 * orchestrator decides when to call them.
 *
 * Auth: Atlassian API tokens (basic auth with the user's email + token).
 * OAuth 3LO is the right production move; token auth lets us land the
 * integration before standing up an Atlassian OAuth app.
 */

import { env } from "../env";
import { decryptSecret } from "../crypto";

export interface JiraConnectionConfig {
  baseUrl: string; // https://acme.atlassian.net
  email: string;
  apiToken: string; // plain text, decrypted at the call site
}

export interface JiraProjectSummary {
  key: string;
  name: string;
  projectTypeKey: string;
}

export interface JiraIssueSummary {
  key: string;
  issueType: string;
  summary: string;
  status: string;
  assignee: string | null;
  priority: string | null;
  sprint: string | null;
  parentKey: string | null;
  updated: string;
}

/**
 * Decrypt the stored API token the way the GitHub token is handled elsewhere.
 * When `AUTH_SECRET` is absent (local dev) the ciphertext is the plain token.
 */
export function openConnection(row: {
  baseUrl: string;
  email: string;
  apiTokenCipher: string;
}): JiraConnectionConfig {
  const apiToken = env.AUTH_SECRET
    ? decryptSecret(row.apiTokenCipher) ?? row.apiTokenCipher
    : row.apiTokenCipher;
  return { baseUrl: row.baseUrl.replace(/\/$/, ""), email: row.email, apiToken };
}

function headers(cfg: JiraConnectionConfig) {
  const basic = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function get<T>(cfg: JiraConnectionConfig, path: string): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "GET",
    headers: headers(cfg),
  });
  if (!res.ok) {
    throw new Error(`Jira GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(
  cfg: JiraConnectionConfig,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Jira POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Smoke test: do these creds reach Jira and name a real user? Called on
 * "Connect" to prove the token works before we store it.
 */
export async function verifyConnection(cfg: JiraConnectionConfig): Promise<{
  accountId: string;
  displayName: string;
  emailAddress: string;
}> {
  return get(cfg, "/rest/api/3/myself");
}

export async function listProjects(
  cfg: JiraConnectionConfig
): Promise<JiraProjectSummary[]> {
  const page = await get<{ values: JiraProjectSummary[] }>(
    cfg,
    "/rest/api/3/project/search?orderBy=name"
  );
  return page.values ?? [];
}

/**
 * Pull the issues the BA pipeline is going to care about. The JQL stays
 * generous — we filter further in-app — so a project switch doesn't need
 * another round-trip.
 */
export async function listIssues(
  cfg: JiraConnectionConfig,
  projectKey: string,
  opts: { maxResults?: number } = {}
): Promise<{ raw: unknown; issues: JiraIssueSummary[] }> {
  const jql = encodeURIComponent(`project = ${projectKey} ORDER BY updated DESC`);
  const maxResults = opts.maxResults ?? 100;
  const path = `/rest/api/3/search?jql=${jql}&maxResults=${maxResults}&fields=summary,status,issuetype,assignee,priority,parent,customfield_10020,updated`;
  const raw = await get<{ issues: unknown[] }>(cfg, path);
  const issues = (raw.issues ?? []).map(toIssueSummary);
  return { raw, issues };
}

export async function getIssue(
  cfg: JiraConnectionConfig,
  key: string
): Promise<{ raw: unknown; summary: JiraIssueSummary }> {
  const raw = await get<unknown>(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}`);
  return { raw, summary: toIssueSummary(raw) };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: { id: string; name: string };
}

export async function listTransitions(
  cfg: JiraConnectionConfig,
  key: string
): Promise<JiraTransition[]> {
  const res = await get<{ transitions: JiraTransition[] }>(
    cfg,
    `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`
  );
  return res.transitions ?? [];
}

export async function transitionIssue(
  cfg: JiraConnectionConfig,
  key: string,
  transitionId: string
): Promise<void> {
  await post(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
    transition: { id: transitionId },
  });
}

export async function addIssueComment(
  cfg: JiraConnectionConfig,
  key: string,
  body: string
): Promise<void> {
  await post(cfg, `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    body: textToAdf(body),
  });
}

/**
 * Convert plain text to Atlassian Document Format: blank-line-separated
 * paragraphs, with a run of "- " lines rendered as a bullet list. Good enough
 * for the descriptions we generate (BRD narrative, plan steps, devops notes);
 * not a general markdown→ADF converter.
 */
export function textToAdf(text: string): object {
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const content = blocks.map((block) => {
    const lines = block.split("\n").map((l) => l.trim());
    if (lines.every((l) => l.startsWith("- "))) {
      return {
        type: "bulletList",
        content: lines.map((l) => ({
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: l.slice(2) }] },
          ],
        })),
      };
    }
    return { type: "paragraph", content: [{ type: "text", text: block }] };
  });
  return { type: "doc", version: 1, content: content.length > 0 ? content : [{ type: "paragraph", content: [] }] };
}

export interface CreateIssueInput {
  projectKey: string;
  issueType: string; // "Story" | "Task" | "Sub-task" | ...
  summary: string;
  description: string; // plain text; converted to ADF
  /** Epic key (for a top-level story) or parent issue key (required for a Sub-task). */
  parentKey?: string;
}

/**
 * File a new Jira issue. The platform never rewrites existing Jira state —
 * this only creates the tickets Baton's pipeline files on top of a request
 * (product + delivery tickets); humans and existing Jira automation own
 * everything else about the issue's lifecycle.
 */
export async function createIssue(
  cfg: JiraConnectionConfig,
  input: CreateIssueInput
): Promise<{ key: string; url: string }> {
  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    issuetype: { name: input.issueType },
    summary: input.summary,
    description: textToAdf(input.description),
  };
  if (input.parentKey) fields.parent = { key: input.parentKey };

  const res = await post<{ key: string }>(cfg, "/rest/api/3/issue", { fields });
  return { key: res.key, url: `${cfg.baseUrl}/browse/${res.key}` };
}

function toIssueSummary(raw: unknown): JiraIssueSummary {
  const r = raw as {
    key: string;
    fields: {
      summary: string;
      status: { name: string };
      issuetype: { name: string };
      assignee: { displayName: string } | null;
      priority: { name: string } | null;
      parent: { key: string } | null;
      updated: string;
      customfield_10020?: Array<{ name?: string; state?: string }>;
    };
  };
  const sprint =
    r.fields.customfield_10020?.find((s) => s.state === "active")?.name ??
    r.fields.customfield_10020?.[0]?.name ??
    null;
  return {
    key: r.key,
    issueType: r.fields.issuetype?.name ?? "Task",
    summary: r.fields.summary,
    status: r.fields.status?.name ?? "Unknown",
    assignee: r.fields.assignee?.displayName ?? null,
    priority: r.fields.priority?.name ?? null,
    sprint,
    parentKey: r.fields.parent?.key ?? null,
    updated: r.fields.updated,
  };
}
