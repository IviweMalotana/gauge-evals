/**
 * The deliverable catalog: the hybrid project-management toolkit Baton ships.
 *
 * The set is deliberately a "best of" across methodologies — PMBOK for
 * chartering and governance, Lean Six Sigma (DMAIC) for process improvement,
 * Agile for cadence reporting and continuous learning. Every kind renders and
 * edits through the same generic shape: prose sections + tables.
 */

export type DeliverableKind =
  | "charter"
  | "raci"
  | "risk_register"
  | "dmaic"
  | "status_report"
  | "retrospective";

export interface DeliverableSection {
  heading: string;
  body: string;
}

export interface DeliverableTable {
  title: string;
  headers: string[];
  rows: string[][];
}

/** The generic document shape every kind generates, edits, and renders. */
export interface DeliverableContent {
  title: string;
  summary: string;
  sections: DeliverableSection[];
  tables: DeliverableTable[];
}

export interface DeliverableKindMeta {
  kind: DeliverableKind;
  label: string;
  methodology: string; // where the artifact comes from, shown as a badge
  description: string; // one-liner for the picker
  /** Kind-specific structure guidance appended to the generator prompt. */
  guidance: string;
}

export const DELIVERABLE_KINDS: DeliverableKindMeta[] = [
  {
    kind: "charter",
    label: "Project Charter",
    methodology: "PMBOK",
    description:
      "Authorizes the work: problem, goal, scope, stakeholders, milestones, success criteria.",
    guidance: `Sections: "Problem Statement", "Goal & Business Case", "Scope" (in and out of scope),
"Success Criteria", "Assumptions & Constraints". Tables: "Key Stakeholders"
(headers: Name, Role, Interest) and "Milestones" (headers: Milestone, Target, Status).`,
  },
  {
    kind: "raci",
    label: "RACI Matrix",
    methodology: "PMBOK",
    description:
      "Who is Responsible, Accountable, Consulted, and Informed for each activity.",
    guidance: `One short section "How to read this matrix" explaining R/A/C/I. One table "RACI Matrix"
whose first header is "Activity" followed by one header per person or role; cells hold
R, A, C, I, or blank. Every activity row must have exactly one A.`,
  },
  {
    kind: "risk_register",
    label: "Risk Register",
    methodology: "PMBOK",
    description:
      "Risks with likelihood, impact, severity, and a named mitigation owner.",
    guidance: `One short section "Review cadence" on how often the register is walked. One table
"Risk Register" (headers: ID, Risk, Likelihood, Impact, Severity, Mitigation, Owner).
Severity is Likelihood × Impact expressed as Low / Medium / High / Critical.`,
  },
  {
    kind: "dmaic",
    label: "DMAIC Improvement Plan",
    methodology: "Lean Six Sigma",
    description:
      "Define → Measure → Analyze → Improve → Control, with metrics and a control plan.",
    guidance: `Five sections named exactly "Define", "Measure", "Analyze", "Improve", "Control",
each 1-2 short paragraphs grounded in the context. Tables: "Metrics" (headers: Metric,
Baseline, Target, Data Source) and "Control Plan" (headers: Control, Method, Frequency, Owner).`,
  },
  {
    kind: "status_report",
    label: "Status Report",
    methodology: "Agile",
    description:
      "Snapshot for stakeholders: progress, health, blockers, and what's next.",
    guidance: `Sections: "Highlights", "Blockers & Risks", "Up Next". Tables: "Work Item Status"
(headers: Item, Stage, Health) and "Pipeline Summary" (headers: Measure, Count).
Health is On track / At risk / Blocked.`,
  },
  {
    kind: "retrospective",
    label: "Retrospective & Lessons Learned",
    methodology: "Agile / Kaizen",
    description:
      "What went well, what didn't, and concrete improvement actions with owners.",
    guidance: `Sections: "What went well", "What didn't go well", "What we learned". One table
"Improvement Actions" (headers: Action, Owner, Due). Actions must be concrete and small
enough to complete before the next cycle (kaizen).`,
  },
];

export function kindMeta(kind: string): DeliverableKindMeta | null {
  return DELIVERABLE_KINDS.find((k) => k.kind === kind) ?? null;
}

export function isDeliverableKind(value: string): value is DeliverableKind {
  return DELIVERABLE_KINDS.some((k) => k.kind === value);
}

/** Defensive parse of the JSON columns; never throws on bad data. */
export function parseContent(row: {
  title: string;
  summary: string;
  sections: string;
  tables: string;
}): DeliverableContent {
  return {
    title: row.title,
    summary: row.summary,
    sections: parseSections(row.sections),
    tables: parseTables(row.tables),
  };
}

export function parseSections(json: string): DeliverableSection[] {
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s) => ({
        heading: String(s?.heading ?? "").trim(),
        body: String(s?.body ?? "").trim(),
      }))
      .filter((s) => s.heading || s.body);
  } catch {
    return [];
  }
}

export function parseTables(json: string): DeliverableTable[] {
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .map((t) => {
        const headers = Array.isArray(t?.headers) ? t.headers.map(String) : [];
        const rows = Array.isArray(t?.rows)
          ? t.rows.map((r: unknown) =>
              Array.isArray(r) ? r.map(String) : [String(r ?? "")]
            )
          : [];
        return { title: String(t?.title ?? "").trim(), headers, rows };
      })
      .filter((t) => t.headers.length > 0);
  } catch {
    return [];
  }
}
