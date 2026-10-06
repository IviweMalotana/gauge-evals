/**
 * Product baseline — the entry point for Product Initialization (spec §4-§8).
 *
 * The baseline is the platform's persistent understanding of an existing
 * application. On first connect we scan the chosen repo once and populate the
 * knowledge-model tables (`Project` → `Module` / `Screen` / `Route` / `Entity`
 * / `Api` / `BusinessRule` / `UserJourney`). Subsequent runs are incremental:
 * a merged PR triggers a scan limited to the paths it touched.
 *
 * Observed vs inferred vs unknown is the honest distinction the spec insists
 * on; each row carries a `confidence` so the UI can show "requires human
 * confirmation" where it matters.
 *
 * The heavy lifting (AST walks, framework-specific route detection, Prisma /
 * SQL / Mongoose entity extraction, OpenAPI derivation, C4 / BPMN / ERD
 * rendering) is split per language in follow-up PRs. This file is the stable
 * seam the orchestrator calls into.
 */

import { db } from "../db";
import type { EvidenceConfidence } from "../domain";

export interface BaselineOptions {
  companyId: string;
  projectId: string;
  repoFullName: string;
  /** Only re-scan paths that match these globs. Omit for a full baseline. */
  changedPaths?: string[];
}

export interface BaselineReport {
  projectId: string;
  routes: number;
  screens: number;
  entities: number;
  apis: number;
  components: number;
  journeys: number;
  rules: number;
  startedAt: Date;
  finishedAt: Date;
}

export interface EvidenceRow<T = unknown> {
  value: T;
  confidence: EvidenceConfidence;
  evidence: { files?: string[]; notes?: string };
}

/**
 * Record a Route the scanner has found. Used by the per-language extractors
 * that will land in follow-up PRs; here so they share one write path.
 */
export async function upsertRoute(
  projectId: string,
  row: EvidenceRow<{ path: string; method: string; kind: "page" | "api" }>
): Promise<void> {
  await db.route.upsert({
    where: {
      projectId_kind_method_path: {
        projectId,
        kind: row.value.kind,
        method: row.value.method,
        path: row.value.path,
      },
    },
    create: {
      projectId,
      path: row.value.path,
      method: row.value.method,
      kind: row.value.kind,
      evidence: JSON.stringify(row.evidence),
    },
    update: { evidence: JSON.stringify(row.evidence) },
  });
}

export async function upsertScreen(
  projectId: string,
  row: EvidenceRow<{ name: string; purpose?: string; states?: string[] }>
): Promise<void> {
  await db.screen.upsert({
    where: { projectId_name: { projectId, name: row.value.name } },
    create: {
      projectId,
      name: row.value.name,
      purpose: row.value.purpose ?? "",
      states: JSON.stringify(row.value.states ?? []),
      evidence: JSON.stringify(row.evidence),
      confidence: row.confidence,
    },
    update: {
      purpose: row.value.purpose ?? "",
      states: JSON.stringify(row.value.states ?? []),
      evidence: JSON.stringify(row.evidence),
      confidence: row.confidence,
    },
  });
}

/**
 * Minimal baseline that records a "scan was run" marker on the project. The
 * per-language extractors call the `upsert*` helpers above as they go; this
 * entry point gives the orchestrator one call to make and one report to log.
 *
 * The real extractors (Next.js routes, Prisma models, OpenAPI, Playwright
 * test discovery) land in follow-up PRs — the stable seam is here.
 */
export async function runBaseline(opts: BaselineOptions): Promise<BaselineReport> {
  const startedAt = new Date();

  // Placeholder: future per-language extractors call upsertRoute / upsertScreen /
  // etc. here. For now the baseline just stamps the project and reports counts.
  const [routes, screens, entities, apis, components, journeys, rules] =
    await Promise.all([
      db.route.count({ where: { projectId: opts.projectId } }),
      db.screen.count({ where: { projectId: opts.projectId } }),
      db.entity.count({ where: { projectId: opts.projectId } }),
      db.api.count({ where: { projectId: opts.projectId } }),
      db.uiComponent.count({ where: { projectId: opts.projectId } }),
      db.userJourney.count({ where: { projectId: opts.projectId } }),
      db.businessRule.count({ where: { projectId: opts.projectId } }),
    ]);

  await db.project.update({
    where: { id: opts.projectId },
    data: { baselineAt: new Date() },
  });

  return {
    projectId: opts.projectId,
    routes,
    screens,
    entities,
    apis,
    components,
    journeys,
    rules,
    startedAt,
    finishedAt: new Date(),
  };
}
