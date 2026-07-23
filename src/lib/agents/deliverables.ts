import { db } from "../db";
import { completeJson, getAnthropic } from "../anthropic";
import { env, features } from "../env";
import { statusLabel } from "../pipeline-view";
import {
  kindMeta,
  parseSections,
  parseTables,
  type DeliverableContent,
  type DeliverableKind,
  type DeliverableTable,
} from "../deliverables/kinds";

/**
 * Deliverable generator.
 *
 * Produces a project-management deliverable (charter, RACI, risk register,
 * DMAIC plan, status report, retrospective) grounded in what Baton already
 * knows: the company, its members, the request pipeline, and — when scoped to
 * a request — that request's BRD, plan, and verification results.
 *
 * Uses the Anthropic API when configured; falls back to deterministic,
 * pre-filled templates so the feature works end-to-end without a key.
 */

const SYSTEM_BASE = `You are a senior program manager fluent in PMBOK, Lean Six Sigma, and Agile.
You produce crisp, business-facing project-management deliverables that a stakeholder
can read without technical background. Ground everything in the provided context —
never invent people, dates, or metrics that contradict it. Where the context is thin,
write sensible placeholders in angle brackets like <owner> or <target date> that a
human editor will fill in.

Reply with a single JSON object only, matching exactly this shape:
{
  "title": string,                 // document title, specific to this company/request
  "summary": string,               // 2-3 sentence executive summary
  "sections": [{ "heading": string, "body": string }],
  "tables": [{ "title": string, "headers": string[], "rows": string[][] }]
}
Every table row must have exactly as many cells as there are headers.`;

export interface GenerationResult {
  content: DeliverableContent;
  model: string; // model id, or "template-fallback"
}

interface GenerationContext {
  companyName: string;
  members: { name: string; role: string }[];
  request: {
    title: string;
    description: string;
    type: string;
    status: string;
    priority: string;
    brdNarrative: string | null;
    acceptanceCriteria: string[];
    planSummary: string | null;
    planSteps: string[];
    checks: { kind: string; passed: boolean; summary: string }[];
    prUrl: string | null;
  } | null;
  pipeline: { total: number; byStatus: Record<string, number> };
}

/** Pull everything the prompt (and the fallbacks) can be grounded in. */
export async function buildGenerationContext(
  companyId: string,
  requestId: string | null
): Promise<GenerationContext> {
  const [company, memberships, requests] = await Promise.all([
    db.company.findUniqueOrThrow({ where: { id: companyId }, select: { name: true } }),
    db.membership.findMany({
      where: { companyId },
      include: { user: { select: { name: true, email: true } } },
    }),
    db.request.findMany({
      where: { companyId },
      select: { status: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  let request: GenerationContext["request"] = null;
  if (requestId) {
    const row = await db.request.findFirst({
      where: { id: requestId, companyId },
      include: { brd: true, plan: true, checks: true, pullReq: true },
    });
    if (row) {
      request = {
        title: row.title,
        description: row.description,
        type: row.type,
        status: row.status,
        priority: row.priority,
        brdNarrative: row.brd?.narrative ?? null,
        acceptanceCriteria: safeStringArray(row.brd?.acceptanceCriteria),
        planSummary: row.plan?.summary ?? null,
        planSteps: safeStringArray(row.plan?.steps),
        checks: row.checks.map((c) => ({
          kind: c.kind,
          passed: c.passed,
          summary: c.summary,
        })),
        prUrl: row.pullReq?.url ?? null,
      };
    }
  }

  return {
    companyName: company.name,
    members: memberships.map((m) => ({
      name: m.user.name ?? m.user.email,
      role: m.role,
    })),
    request,
    pipeline: { total: requests.length, byStatus },
  };
}

function safeStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

function contextPrompt(ctx: GenerationContext): string {
  const lines: string[] = [
    `Company: ${ctx.companyName}`,
    `Team (${ctx.members.length}): ${ctx.members.map((m) => `${m.name} (${m.role})`).join(", ") || "none listed"}`,
    `Request pipeline: ${ctx.pipeline.total} total — ${
      Object.entries(ctx.pipeline.byStatus)
        .map(([s, n]) => `${statusLabel(s)}: ${n}`)
        .join(", ") || "empty"
    }`,
  ];
  if (ctx.request) {
    const r = ctx.request;
    lines.push(
      "",
      `Scoped to request: "${r.title}" (${r.type.toLowerCase()}, priority ${r.priority}, stage: ${statusLabel(r.status)})`,
      `Description: ${r.description}`
    );
    if (r.brdNarrative) lines.push(`BRD narrative: ${r.brdNarrative}`);
    if (r.acceptanceCriteria.length)
      lines.push(`Acceptance criteria: ${r.acceptanceCriteria.join(" | ")}`);
    if (r.planSummary) lines.push(`Implementation plan: ${r.planSummary}`);
    if (r.checks.length)
      lines.push(
        `Verification: ${r.checks.map((c) => `${c.kind} ${c.passed ? "passed" : "failed"}`).join(", ")}`
      );
    if (r.prUrl) lines.push(`Pull request: ${r.prUrl}`);
  } else {
    lines.push("", "Scope: the whole company workspace (no single request).");
  }
  return lines.join("\n");
}

export async function generateDeliverable(
  kind: DeliverableKind,
  ctx: GenerationContext
): Promise<GenerationResult> {
  const meta = kindMeta(kind)!;

  if (!features.anthropic || !getAnthropic()) {
    return { content: fallbackContent(kind, ctx), model: "template-fallback" };
  }

  const system = `${SYSTEM_BASE}

You are writing a ${meta.label} (${meta.methodology}). ${meta.guidance}`;

  try {
    const json = await completeJson({
      system,
      user: `${contextPrompt(ctx)}

Write the ${meta.label} as JSON.`,
      maxTokens: 3000,
    });
    const content: DeliverableContent = {
      title: String(json.title ?? "").trim() || defaultTitle(kind, ctx),
      summary: String(json.summary ?? "").trim(),
      sections: parseSections(JSON.stringify(json.sections ?? [])),
      tables: parseTables(JSON.stringify(json.tables ?? [])),
    };
    if (content.sections.length === 0 && content.tables.length === 0) {
      throw new Error("Model returned an empty deliverable");
    }
    return { content, model: env.ANTHROPIC_MODEL };
  } catch {
    return { content: fallbackContent(kind, ctx), model: "template-fallback" };
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallbacks — pre-filled with real workspace data so they're
// useful documents to adjust, not empty scaffolds.
// ---------------------------------------------------------------------------

function defaultTitle(kind: DeliverableKind, ctx: GenerationContext): string {
  const meta = kindMeta(kind)!;
  const scope = ctx.request ? ctx.request.title : ctx.companyName;
  return `${meta.label} — ${scope}`;
}

function fallbackContent(
  kind: DeliverableKind,
  ctx: GenerationContext
): DeliverableContent {
  switch (kind) {
    case "charter":
      return charterFallback(ctx);
    case "raci":
      return raciFallback(ctx);
    case "risk_register":
      return riskRegisterFallback(ctx);
    case "dmaic":
      return dmaicFallback(ctx);
    case "status_report":
      return statusReportFallback(ctx);
    case "retrospective":
      return retrospectiveFallback(ctx);
  }
}

function charterFallback(ctx: GenerationContext): DeliverableContent {
  const r = ctx.request;
  const stakeholders: DeliverableTable = {
    title: "Key Stakeholders",
    headers: ["Name", "Role", "Interest"],
    rows: ctx.members.map((m) => [m.name, m.role, "<interest>"]),
  };
  return {
    title: defaultTitle("charter", ctx),
    summary: r
      ? `Charter authorizing work on "${r.title}" for ${ctx.companyName}. Defines the problem, scope, and success criteria so delivery can be validated by stakeholders.`
      : `Charter for the current initiative at ${ctx.companyName}. Defines the problem, scope, and success criteria before work begins.`,
    sections: [
      {
        heading: "Problem Statement",
        body: r
          ? r.description
          : "<Describe the problem this initiative addresses, who it affects, and its cost of inaction.>",
      },
      {
        heading: "Goal & Business Case",
        body: r?.brdNarrative
          ? r.brdNarrative
          : "<State the measurable goal and why it is worth the investment.>",
      },
      {
        heading: "Scope",
        body: "In scope: <what will be delivered>.\nOut of scope: <what is explicitly excluded>.",
      },
      {
        heading: "Success Criteria",
        body: r?.acceptanceCriteria.length
          ? r.acceptanceCriteria.map((c) => `• ${c}`).join("\n")
          : "• <Observable outcome 1>\n• <Observable outcome 2>",
      },
      {
        heading: "Assumptions & Constraints",
        body: "<Key assumptions the plan depends on, and hard constraints (budget, dates, compliance).>",
      },
    ],
    tables: [
      stakeholders,
      {
        title: "Milestones",
        headers: ["Milestone", "Target", "Status"],
        rows: [
          ["Requirements approved (BRD)", "<date>", r?.brdNarrative ? "Done" : "Pending"],
          ["Build complete", "<date>", "Pending"],
          ["QA verified", "<date>", "Pending"],
          ["Pull request merged", "<date>", r?.prUrl ? "In review" : "Pending"],
        ],
      },
    ],
  };
}

function raciFallback(ctx: GenerationContext): DeliverableContent {
  const people = ctx.members.length
    ? ctx.members.map((m) => m.name)
    : ["<Owner>", "<Collaborator>", "<Stakeholder>"];
  // A sensible default assignment: first member accountable, rest responsible/consulted.
  const assign = (active: number[]): string[] =>
    people.map((_, i) => (i === 0 ? "A" : active.includes(i) ? "R" : "C"));
  const activities = [
    "File and refine the request",
    "Approve the BRD",
    "Plan and build the change",
    "Verify acceptance criteria (QA)",
    "Review and merge the pull request",
  ];
  return {
    title: defaultTitle("raci", ctx),
    summary: `Accountability map for ${ctx.request ? `"${ctx.request.title}"` : ctx.companyName}: one Accountable owner per activity, with Responsible, Consulted, and Informed roles made explicit.`,
    sections: [
      {
        heading: "How to read this matrix",
        body: "R = Responsible (does the work) · A = Accountable (owns the outcome; exactly one per activity) · C = Consulted (two-way input) · I = Informed (kept up to date). Adjust cells to match how your team actually works.",
      },
    ],
    tables: [
      {
        title: "RACI Matrix",
        headers: ["Activity", ...people],
        rows: activities.map((a, i) => [a, ...assign([(i % Math.max(people.length - 1, 1)) + 1])]),
      },
    ],
  };
}

function riskRegisterFallback(ctx: GenerationContext): DeliverableContent {
  const owner = ctx.members[0]?.name ?? "<owner>";
  const rows: string[][] = [
    ["R1", "Requirements approved without stakeholder review", "Medium", "High", "High", "Enforce the BRD approval gate before any build starts", owner],
    ["R2", "Change breaks existing behaviour", "Medium", "High", "High", "Run regression verification against a preview build before merge", owner],
    ["R3", "Key dependency unavailable (API key, repo access)", "Low", "Medium", "Medium", "Fallback paths keep the pipeline running; monitor configuration", owner],
    ["R4", "Scope creep after approval", "Medium", "Medium", "Medium", "Route new asks through a fresh request instead of widening this one", owner],
  ];
  if (ctx.request?.checks.some((c) => !c.passed)) {
    rows.unshift([
      "R0",
      `Verification currently failing on "${ctx.request.title}"`,
      "High",
      "High",
      "Critical",
      "Fix and re-run failed checks before release",
      owner,
    ]);
  }
  return {
    title: defaultTitle("risk_register", ctx),
    summary: `Live risk register for ${ctx.request ? `"${ctx.request.title}"` : ctx.companyName}. Severity combines likelihood and impact; every risk has a named mitigation owner.`,
    sections: [
      {
        heading: "Review cadence",
        body: "Walk this register at each status checkpoint. Close risks that no longer apply, re-score the ones that changed, and add new ones as they surface — a register that isn't reviewed is decoration.",
      },
    ],
    tables: [
      {
        title: "Risk Register",
        headers: ["ID", "Risk", "Likelihood", "Impact", "Severity", "Mitigation", "Owner"],
        rows,
      },
    ],
  };
}

function dmaicFallback(ctx: GenerationContext): DeliverableContent {
  const r = ctx.request;
  const scope = r ? `"${r.title}"` : `the ${ctx.companyName} delivery flow`;
  return {
    title: defaultTitle("dmaic", ctx),
    summary: `Lean Six Sigma improvement plan for ${scope}: define the problem, baseline it with data, find root causes, pilot the fix, and lock the gains in with controls.`,
    sections: [
      {
        heading: "Define",
        body: r
          ? `Problem: ${r.description}\nGoal: deliver the outcome described in the approved requirements, validated by a non-technical reviewer.`
          : "<State the problem, the affected process, the customer, and the goal in measurable terms.>",
      },
      {
        heading: "Measure",
        body: "Establish the baseline before changing anything: how often does the problem occur, how long does the process take, where is the variation? Record the metrics below with their data sources.",
      },
      {
        heading: "Analyze",
        body: "Identify root causes rather than symptoms — 5 Whys or a fishbone diagram against the measured data. Validate each suspected cause with evidence before acting on it.",
      },
      {
        heading: "Improve",
        body: r?.planSummary
          ? `Planned improvement: ${r.planSummary}\nPilot the change, compare results against the baseline, and iterate before full rollout.`
          : "<Design and pilot the fix; compare pilot results against the baseline before rolling out.>",
      },
      {
        heading: "Control",
        body: "Lock in the gains so the process doesn't drift back: monitoring, updated working agreements, and a clear owner for each control listed below.",
      },
    ],
    tables: [
      {
        title: "Metrics",
        headers: ["Metric", "Baseline", "Target", "Data Source"],
        rows: [
          ["Defect / rework rate", "<baseline>", "<target>", "Verification results"],
          ["Lead time (request → PR)", "<baseline>", "<target>", "Pipeline timestamps"],
          ["First-pass approval rate", "<baseline>", "<target>", "BRD approvals"],
        ],
      },
      {
        title: "Control Plan",
        headers: ["Control", "Method", "Frequency", "Owner"],
        rows: [
          ["Approval gate before build", "BRD accept/reject/alter", "Every request", ctx.members[0]?.name ?? "<owner>"],
          ["Regression verification", "Browser-driven checks pre-merge", "Every change", "<owner>"],
          ["Register & metrics review", "Status checkpoint", "Weekly", "<owner>"],
        ],
      },
    ],
  };
}

function statusReportFallback(ctx: GenerationContext): DeliverableContent {
  const attention = ctx.pipeline.byStatus["AWAITING_APPROVAL"] ?? 0;
  const failed = ctx.pipeline.byStatus["FAILED"] ?? 0;
  const done = ctx.pipeline.byStatus["DONE"] ?? 0;
  const health = failed > 0 ? "At risk" : "On track";
  return {
    title: defaultTitle("status_report", ctx),
    summary: `Point-in-time status for ${ctx.companyName}: ${ctx.pipeline.total} request(s) in the pipeline, ${done} completed, ${attention} awaiting approval, ${failed} failed. Overall: ${health}.`,
    sections: [
      {
        heading: "Highlights",
        body: done > 0
          ? `${done} request(s) have completed the full pipeline through to a pull request.`
          : "No requests have completed the full pipeline yet.",
      },
      {
        heading: "Blockers & Risks",
        body:
          (attention > 0
            ? `${attention} request(s) are waiting on a human BRD approval — the pipeline is paused until a reviewer decides. `
            : "") +
          (failed > 0
            ? `${failed} request(s) failed a stage and need a retry or investigation.`
            : failed === 0 && attention === 0
              ? "Nothing is currently blocked."
              : ""),
      },
      {
        heading: "Up Next",
        body: "<What the team intends to move through the pipeline before the next report.>",
      },
    ],
    tables: [
      {
        title: "Pipeline Summary",
        headers: ["Measure", "Count"],
        rows: [
          ["Total requests", String(ctx.pipeline.total)],
          ...Object.entries(ctx.pipeline.byStatus).map(([s, n]) => [statusLabel(s), String(n)]),
        ],
      },
      ...(ctx.request
        ? [
            {
              title: "Work Item Status",
              headers: ["Item", "Stage", "Health"],
              rows: [
                [
                  ctx.request.title,
                  statusLabel(ctx.request.status),
                  ctx.request.status === "FAILED" ? "Blocked" : "On track",
                ],
              ],
            },
          ]
        : []),
    ],
  };
}

function retrospectiveFallback(ctx: GenerationContext): DeliverableContent {
  const r = ctx.request;
  const owner = ctx.members[0]?.name ?? "<owner>";
  return {
    title: defaultTitle("retrospective", ctx),
    summary: `Retrospective for ${r ? `"${r.title}"` : ctx.companyName}: what went well, what didn't, and small concrete improvements to make before the next cycle.`,
    sections: [
      {
        heading: "What went well",
        body: r?.checks.filter((c) => c.passed).length
          ? r.checks
              .filter((c) => c.passed)
              .map((c) => `• ${c.kind} verification passed — ${c.summary}`)
              .join("\n")
          : "• <Something the team should keep doing.>",
      },
      {
        heading: "What didn't go well",
        body: r?.checks.filter((c) => !c.passed).length
          ? r.checks
              .filter((c) => !c.passed)
              .map((c) => `• ${c.kind} verification failed — ${c.summary}`)
              .join("\n")
          : "• <Friction, surprises, or rework worth naming without blame.>",
      },
      {
        heading: "What we learned",
        body: "<The one or two insights that should change how the next cycle runs.>",
      },
    ],
    tables: [
      {
        title: "Improvement Actions",
        headers: ["Action", "Owner", "Due"],
        rows: [
          ["<Small, concrete improvement to try next cycle>", owner, "<date>"],
        ],
      },
    ],
  };
}
