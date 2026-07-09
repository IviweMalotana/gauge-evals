import { completeText, getAnthropic } from "../anthropic";
import { features } from "../env";
import { db } from "../db";
import type { GhClient } from "../github";
import {
  newRequirementId,
  requirementPath,
  serializeRequirement,
  REQUIREMENT_CATEGORIES,
  type RequirementCategory,
  type RequirementFeature,
} from "../requirements/format";
import { searchRequirements } from "../requirements/store";
import { buildRequirementBody, salvageArray, type SeedScenario } from "../requirements/seed";
import type { AgentContext, BrdResult } from "./types";

/**
 * Impact-analysis agent (Phase 3 of the living-requirements system).
 *
 * After the BRD is drafted, this retrieves the requirements most related to the
 * request from the corpus index and asks Claude which existing requirements the
 * change AFFECTS, plus what NEW or UPDATED Gherkin the change implies. The
 * result is surfaced at the human approval gate and — once approved — the
 * drafted `.feature` changes are committed onto the build branch so the PR
 * carries code + requirements together.
 *
 * It never fails the pipeline: with no corpus / no key it returns null and the
 * request proceeds as before.
 */

const IMPACT_SYSTEM = `You maintain a living requirements corpus (Cucumber/Gherkin) for a codebase.

Given a stakeholder request, its drafted BRD, and the CANDIDATE existing
requirements most related to it, decide the change's impact on the corpus:
- which candidate requirements are AFFECTED (their behaviour changes) and why,
- UPDATED requirements: for each affected one, the revised scenarios,
- NEW requirements: behaviour this introduces that isn't covered yet.

Rules:
- Only reference candidate requirements by their given reqId; never invent ids.
- Write scenarios as plain business language (BA/QA voice), valid Given/When/Then.
- Be conservative: only mark a requirement affected if the change really alters
  its behaviour. Prefer a small, precise set over speculative churn.

Reply with a SINGLE JSON object only, matching exactly:
{
  "summary": string,                       // 1-2 sentences on the overall impact
  "related": [
    { "reqId": string, "affected": boolean, "reason": string }
  ],
  "drafts": [
    {
      "op": "update" | "new",
      "reqId": string,                     // required when op = "update" (an affected candidate)
      "category": "ux" | "design" | "backend" | "data" | "api",
      "title": string,
      "narrative": string,
      "codeAreas": string[],
      "scenarios": [
        { "name": string, "given": string[], "when": string[], "then": string[] }
      ]
    }
  ]
}`;

export interface RelatedRequirement {
  reqId: string;
  title: string;
  category: string;
  filePath: string;
  affected: boolean;
  reason: string;
}

export interface RequirementDraft {
  op: "update" | "new";
  reqId: string; // existing id for update, freshly assigned for new
  category: RequirementCategory;
  title: string;
  filePath: string;
  body: string; // assembled Gherkin (under `Feature:`)
  codeAreas: string[];
}

export interface ImpactResult {
  summary: string;
  related: RelatedRequirement[];
  drafts: RequirementDraft[];
}

interface CandidateReq {
  reqId: string;
  title: string;
  category: string;
  filePath: string;
  body: string;
}

const MAX_CANDIDATES = 12;

/** Build the retrieval query from the request + BRD. Pure. */
export function impactQuery(request: { title: string; description: string }, brd: BrdResult): string {
  return [request.title, request.description, brd.narrative, ...brd.acceptanceCriteria].join(" ");
}

/**
 * Turn the model's raw related/drafts arrays into an ImpactResult, resolving
 * drafts against the candidates (update → existing id/path/category; new →
 * fresh id/path). Drops malformed entries and unknown reqIds. Pure.
 */
export function parseImpactResponse(
  related: unknown[],
  drafts: unknown[],
  candidates: CandidateReq[],
  summary: string
): ImpactResult {
  const byId = new Map(candidates.map((c) => [c.reqId, c]));

  const relatedOut: RelatedRequirement[] = [];
  for (const r of related) {
    const o = r as { reqId?: unknown; affected?: unknown; reason?: unknown };
    const cand = typeof o.reqId === "string" ? byId.get(o.reqId) : undefined;
    if (!cand) continue;
    relatedOut.push({
      reqId: cand.reqId,
      title: cand.title,
      category: cand.category,
      filePath: cand.filePath,
      affected: Boolean(o.affected),
      reason: String(o.reason ?? ""),
    });
  }

  const draftsOut: RequirementDraft[] = [];
  for (const d of drafts) {
    const o = d as Partial<{
      op: string;
      reqId: string;
      category: RequirementCategory;
      title: string;
      narrative: string;
      codeAreas: unknown;
      scenarios: unknown;
    }>;
    const op = o.op === "update" ? "update" : "new";
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;

    const scenarios: SeedScenario[] = Array.isArray(o.scenarios)
      ? (o.scenarios as unknown[])
          .map((s) => {
            const sc = s as Partial<SeedScenario>;
            return {
              name: typeof sc.name === "string" ? sc.name : title,
              given: Array.isArray(sc.given) ? sc.given.map(String) : [],
              when: Array.isArray(sc.when) ? sc.when.map(String) : [],
              then: Array.isArray(sc.then) ? sc.then.map(String) : [],
            };
          })
          .filter((s) => s.name)
      : [];
    if (scenarios.length === 0) continue;

    const codeAreas = Array.isArray(o.codeAreas) ? o.codeAreas.map(String) : [];

    if (op === "update") {
      const cand = typeof o.reqId === "string" ? byId.get(o.reqId) : undefined;
      if (!cand) continue; // an update must target a real candidate
      const category = (REQUIREMENT_CATEGORIES as readonly string[]).includes(cand.category)
        ? (cand.category as RequirementCategory)
        : "backend";
      draftsOut.push({
        op: "update",
        reqId: cand.reqId,
        category,
        title,
        filePath: cand.filePath,
        body: buildRequirementBody({ category, title, narrative: o.narrative, codeAreas, scenarios }),
        codeAreas,
      });
    } else {
      const category = (REQUIREMENT_CATEGORIES as readonly string[]).includes(o.category as string)
        ? (o.category as RequirementCategory)
        : "backend";
      const reqId = newRequirementId();
      draftsOut.push({
        op: "new",
        reqId,
        category,
        title,
        filePath: requirementPath(category, reqId),
        body: buildRequirementBody({ category, title, narrative: o.narrative, codeAreas, scenarios }),
        codeAreas,
      });
    }
  }

  return { summary: summary.trim(), related: relatedOut, drafts: draftsOut };
}

/** Serialize a draft to its `.feature` file (path + contents) for committing. */
export function draftToFile(draft: RequirementDraft): { path: string; contents: string } {
  const feature: RequirementFeature = {
    id: draft.reqId,
    title: draft.title,
    category: draft.category,
    status: "accepted",
    version: 1,
    related: [],
    codeAreas: draft.codeAreas,
    body: draft.body,
  };
  return { path: draft.filePath, contents: serializeRequirement(feature) };
}

/** Run impact analysis for a request; returns null when there's nothing to do. */
export async function runImpactAnalysis(
  ctx: AgentContext,
  brd: BrdResult
): Promise<ImpactResult | null> {
  if (!features.anthropic || !getAnthropic() || !ctx.repo) return null;

  const candidateRows = await searchRequirements(ctx.request.companyId, {
    query: impactQuery(ctx.request, brd),
    limit: MAX_CANDIDATES,
  });
  if (candidateRows.length === 0) {
    await ctx.log(
      "No indexed requirements to analyze impact against — seed the corpus in Settings first."
    );
    return null;
  }

  const candidates: CandidateReq[] = candidateRows.map((r) => ({
    reqId: r.reqId,
    title: r.title,
    category: r.category,
    filePath: r.filePath,
    body: r.body,
  }));
  await ctx.log(`Analyzing impact against ${candidates.length} related requirement(s).`, {
    reqIds: candidates.map((c) => c.reqId),
  });

  const text = await completeText({
    system: IMPACT_SYSTEM,
    user: `Request: ${ctx.request.title}
${ctx.request.description}

Drafted BRD:
${brd.narrative}

Acceptance criteria:
${brd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Candidate existing requirements (reference by reqId):
${candidates
  .map(
    (c) => `--- ${c.reqId} [${c.category}] ${c.title} (${c.filePath})\n${c.body}`
  )
  .join("\n\n")}

Return the impact JSON.`,
    maxTokens: 4000,
  });

  const related = salvageArray(text, "related");
  const drafts = salvageArray(text, "drafts");
  let summary = "";
  try {
    const whole = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
      summary?: unknown;
    };
    summary = typeof whole.summary === "string" ? whole.summary : "";
  } catch {
    // summary is optional
  }

  const result = parseImpactResponse(related, drafts, candidates, summary);
  const affected = result.related.filter((r) => r.affected).length;
  await ctx.log(
    `Impact: ${affected} affected requirement(s), ${result.drafts.length} drafted change(s).`
  );
  return result;
}

/** Persist an impact result for a request (upsert). */
export async function saveImpact(requestId: string, impact: ImpactResult): Promise<void> {
  const data = {
    summary: impact.summary,
    related: JSON.stringify(impact.related),
    drafts: JSON.stringify(impact.drafts),
  };
  await db.requirementImpact.upsert({
    where: { requestId },
    create: { requestId, ...data },
    update: data,
  });
}

/** Load an impact result's drafts for a request (for the build phase). */
export async function loadImpactDrafts(requestId: string): Promise<RequirementDraft[]> {
  const row = await db.requirementImpact.findUnique({ where: { requestId } });
  if (!row) return [];
  try {
    return JSON.parse(row.drafts) as RequirementDraft[];
  } catch {
    return [];
  }
}

export type { GhClient };
