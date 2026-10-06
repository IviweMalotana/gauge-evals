import { db } from "../db";
import { createIssue, openConnection } from "../jira/client";
import type { AgentContext, BrdResult, PlanResult } from "./types";

/**
 * Delivery-ticket agent.
 *
 * Files Baton's requirements into Jira in MVP/delivery structure, on top of
 * whatever Jira ticket/epic the request already names:
 *
 *   Epic (Request.jiraIssueKey, if set)
 *     └─ Product ticket   — the true deliverable (title + BRD narrative/criteria)
 *          ├─ Design      — the UX/prototype change
 *          ├─ Backend     — backend changes
 *          ├─ Frontend    — frontend changes
 *          └─ DevOps      — ONLY when the BRD surfaced work a human or an MCP
 *                           tool must do (Railway/Vercel/Resend/DNS/secrets/...).
 *                           Kept as its own ticket, never folded into the
 *                           product or backend ticket, so it's triaged and
 *                           actioned separately from the automated build.
 *
 * Best-effort: a missing Jira connection, an unlinked Jira project, or an API
 * error never fails the pipeline — it's logged and skipped/recorded, the same
 * way impact analysis is optional.
 */

export type TicketKind = "product" | "design" | "backend" | "frontend" | "devops";

export interface TicketDraft {
  kind: TicketKind;
  title: string;
  body: string;
  needsHuman: boolean;
}

export interface TicketOutcome {
  kind: TicketKind;
  title: string;
  body: string;
  needsHuman: boolean;
  parentKey?: string;
  issueKey?: string;
  url?: string;
  status: "created" | "failed" | "skipped";
  error?: string;
}

const BACKEND_FILE = /(^|\/)(api|server|lib|prisma|jobs?|queue|worker|agents)(\/|$)|route\.ts$|schema\.prisma$/i;
const FRONTEND_FILE = /(^|\/)(components?|app|pages|styles|ui)(\/|$)|\.(css|scss|tsx|jsx)$/i;

function classifyFiles(files: string[]): { backend: string[]; frontend: string[] } {
  const backend: string[] = [];
  const frontend: string[] = [];
  for (const f of files) {
    if (BACKEND_FILE.test(f)) backend.push(f);
    else if (FRONTEND_FILE.test(f)) frontend.push(f);
  }
  return { backend, frontend };
}

/** Build the five (or four) ticket drafts from the request's BRD + plan. Pure. */
export function buildTicketPlan(
  ctx: AgentContext,
  brd: BrdResult,
  plan: PlanResult
): TicketDraft[] {
  const title = ctx.request.title;
  const { backend, frontend } = classifyFiles(plan.files);

  const productBody = [
    brd.narrative,
    brd.acceptanceCriteria.length > 0
      ? `Acceptance criteria:\n${brd.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const designBody = [
    brd.narrative,
    ctx.request.designPrototypeUrl ? `Prototype: ${ctx.request.designPrototypeUrl}` : "",
    "See the product ticket for the full acceptance criteria.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const planBody = [
    plan.summary,
    `Steps:\n${plan.steps.map((s) => `- ${s}`).join("\n")}`,
  ].join("\n\n");

  const backendBody = [
    planBody,
    backend.length > 0 ? `Likely backend files:\n${backend.map((f) => `- ${f}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const frontendBody = [
    planBody,
    frontend.length > 0 ? `Likely frontend files:\n${frontend.map((f) => `- ${f}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const drafts: TicketDraft[] = [
    { kind: "product", title, body: productBody, needsHuman: false },
    { kind: "design", title: `Design — ${title}`, body: designBody, needsHuman: false },
    { kind: "backend", title: `Backend — ${title}`, body: backendBody, needsHuman: false },
    { kind: "frontend", title: `Frontend — ${title}`, body: frontendBody, needsHuman: false },
  ];

  if (brd.devOpsNotes.length > 0) {
    const devopsBody = [
      "This ticket needs a human or an MCP tool to action — it cannot be completed by the automated build pipeline from a pull request.",
      `Work required:\n${brd.devOpsNotes.map((n) => `- ${n}`).join("\n")}`,
    ].join("\n\n");
    drafts.push({ kind: "devops", title: `DevOps — ${title}`, body: devopsBody, needsHuman: true });
  }

  return drafts;
}

/**
 * File the product + delivery tickets in Jira for this request, and persist
 * the outcome (created/failed/skipped) as `DeliveryTicket` rows so the UI can
 * show them. Returns [] (no-op) when the company has no Jira connection or
 * the request isn't linked to a project with a Jira project key.
 */
export async function runTicketCreation(
  ctx: AgentContext,
  brd: BrdResult,
  plan: PlanResult
): Promise<TicketOutcome[]> {
  const connectionRow = await db.jiraConnection.findUnique({
    where: { companyId: ctx.request.companyId },
  });
  if (!connectionRow) {
    await ctx.log("Jira not connected — skipping delivery-ticket creation.");
    return [];
  }

  const projectKey = ctx.request.projectId
    ? (await db.project.findUnique({ where: { id: ctx.request.projectId } }))?.jiraProjectKey ?? null
    : null;
  if (!projectKey) {
    await ctx.log(
      "Request has no Jira project linked (via its Project) — skipping delivery-ticket creation."
    );
    return [];
  }

  const cfg = openConnection(connectionRow);
  const drafts = buildTicketPlan(ctx, brd, plan);
  const epicKey = ctx.request.jiraIssueKey ?? undefined;

  const outcomes: TicketOutcome[] = [];
  let productKey: string | undefined;

  for (const draft of drafts) {
    const parentKey = draft.kind === "product" ? epicKey : productKey;
    const issueType = draft.kind === "product" ? "Story" : "Sub-task";
    let outcome: TicketOutcome;
    try {
      if (draft.kind !== "product" && !parentKey) {
        throw new Error("Product ticket was not created — cannot file a sub-task under it");
      }
      const { key, url } = await createIssue(cfg, {
        projectKey,
        issueType,
        summary: draft.title,
        description: draft.body,
        parentKey,
      });
      if (draft.kind === "product") productKey = key;
      outcome = { ...draft, parentKey, issueKey: key, url, status: "created" };
      await ctx.log(`Filed ${draft.kind} ticket ${key}.`, { url });
    } catch (err) {
      outcome = {
        ...draft,
        parentKey,
        status: "failed",
        error: (err as Error).message,
      };
      await ctx.log(
        `Could not file ${draft.kind} ticket: ${(err as Error).message}`,
        undefined
      );
    }
    outcomes.push(outcome);

    await db.deliveryTicket.upsert({
      where: { requestId_kind: { requestId: ctx.request.id, kind: draft.kind } },
      create: {
        requestId: ctx.request.id,
        kind: draft.kind,
        parentKey: outcome.parentKey ?? null,
        issueKey: outcome.issueKey ?? null,
        url: outcome.url ?? null,
        title: draft.title,
        body: draft.body,
        status: outcome.status,
        error: outcome.error ?? null,
        needsHuman: draft.needsHuman,
      },
      update: {
        parentKey: outcome.parentKey ?? null,
        issueKey: outcome.issueKey ?? null,
        url: outcome.url ?? null,
        title: draft.title,
        body: draft.body,
        status: outcome.status,
        error: outcome.error ?? null,
        needsHuman: draft.needsHuman,
      },
    });
  }

  return outcomes;
}
