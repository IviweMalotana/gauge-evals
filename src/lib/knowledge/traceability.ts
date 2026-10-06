/**
 * Traceability engine.
 *
 * The spec (§14) demands reverse lookups across the chain:
 *   Brief → Requirement → Rule → Gherkin → UX → Jira → Branch → PR → Code
 *          → Playwright → QA → Release → Note.
 *
 * These helpers encode the forward and reverse walks the UI uses. They're
 * read-only — writes happen in the agents / orchestrator — so this module
 * stays safe to call from any route.
 */

import { db } from "../db";

export interface Trace {
  requestId: string;
  requestTitle: string;
  jiraIssueKey: string | null;
  prUrl: string | null;
  prNumber: number | null;
  brdId: string | null;
  brdVersion: number | null;
  requirements: Array<{ reqId: string; title: string; category: string }>;
  verifications: Array<{ kind: string; passed: boolean }>;
  releaseVersion: string | null;
}

/** Everything downstream of one request — what the "Trace" tab renders. */
export async function traceForRequest(requestId: string): Promise<Trace | null> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    include: {
      brd: true,
      pullReq: true,
      impact: true,
      checks: true,
    },
  });
  if (!request) return null;

  const related = parseJsonArray<{ reqId: string }>(request.impact?.related);
  const reqIds = related.map((r) => r.reqId).filter(Boolean);
  const reqs = reqIds.length
    ? await db.requirementDoc.findMany({
        where: { reqId: { in: reqIds } },
        select: { reqId: true, title: true, category: true },
      })
    : [];

  const release = await db.release.findFirst({
    where: {
      companyId: request.companyId,
      ticketLinks: { contains: `"requestId":"${requestId}"` },
    },
    select: { version: true },
  });

  return {
    requestId: request.id,
    requestTitle: request.title,
    jiraIssueKey: request.jiraIssueKey,
    prUrl: request.pullReq?.url ?? null,
    prNumber: request.pullReq?.number ?? null,
    brdId: request.brd?.id ?? null,
    brdVersion: request.brd?.version ?? null,
    requirements: reqs,
    verifications: request.checks.map((c) => ({ kind: c.kind, passed: c.passed })),
    releaseVersion: release?.version ?? null,
  };
}

/** Reverse lookup: "which requests touched this requirement?" */
export async function requestsForRequirement(
  companyId: string,
  reqId: string
): Promise<Array<{ id: string; title: string; status: string }>> {
  const impacts = await db.requirementImpact.findMany({
    where: {
      related: { contains: `"reqId":"${reqId}"` },
      request: { companyId },
    },
    select: { request: { select: { id: true, title: true, status: true } } },
  });
  return impacts.map((i) => i.request);
}

/** Reverse lookup: "which requirements does this PR change?" */
export async function requirementsForPr(prUrl: string): Promise<Array<{ reqId: string; title: string }>> {
  const pr = await db.pullRequestRef.findFirst({
    where: { url: prUrl },
    select: {
      request: {
        select: { impact: { select: { related: true } }, companyId: true },
      },
    },
  });
  if (!pr?.request?.impact) return [];
  const related = parseJsonArray<{ reqId: string; title?: string }>(pr.request.impact.related);
  const ids = related.map((r) => r.reqId);
  if (!ids.length) return [];
  const docs = await db.requirementDoc.findMany({
    where: { reqId: { in: ids }, companyId: pr.request.companyId },
    select: { reqId: true, title: true },
  });
  return docs;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
