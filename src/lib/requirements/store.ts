import { db } from "../db";
import { getFile, getTree, type GhClient } from "../github";
import { parseRequirement, type RequirementFeature } from "./format";

/**
 * Syncs the requirements corpus (source of truth: files in the repo) into
 * Baton's searchable index, and queries it for impact analysis.
 */

const REQ_DIR = "requirements/";

export interface RepoRequirement {
  file: RequirementFeature;
  path: string;
}

/** Read and parse every requirement (.feature) file in the repo at a ref. */
export async function readAllRequirements(
  client: GhClient,
  ref: string
): Promise<RepoRequirement[]> {
  const { entries } = await getTree(client, ref);
  const paths = entries
    .filter((e) => e.type === "blob" && e.path.startsWith(REQ_DIR) && e.path.endsWith(".feature"))
    .map((e) => e.path);

  const out: RepoRequirement[] = [];
  for (const path of paths) {
    const file = await getFile(client, path, ref);
    if (!file) continue;
    try {
      out.push({ file: parseRequirement(file.contents), path });
    } catch {
      // skip malformed requirement files rather than failing the whole sync
    }
  }
  return out;
}

/** Mirror the repo's requirements into the DB index. Returns the count synced. */
export async function syncRequirementIndex(args: {
  companyId: string;
  repo: string;
  client: GhClient;
  ref: string;
}): Promise<number> {
  const items = await readAllRequirements(args.client, args.ref);
  const seen: string[] = [];

  for (const { file, path } of items) {
    seen.push(file.id);
    const data = {
      repo: args.repo,
      category: file.category,
      title: file.title,
      status: file.status,
      version: file.version,
      related: JSON.stringify(file.related),
      codeAreas: JSON.stringify(file.codeAreas),
      body: file.body,
      filePath: path,
      updatedBySource: file.updatedBySource ?? null,
    };
    await db.requirementDoc.upsert({
      where: { companyId_reqId: { companyId: args.companyId, reqId: file.id } },
      create: { companyId: args.companyId, reqId: file.id, ...data },
      update: data,
    });
  }

  // Drop index rows for requirements no longer present in this repo.
  await db.requirementDoc.deleteMany({
    where: { companyId: args.companyId, repo: args.repo, reqId: { notIn: seen } },
  });

  return items.length;
}

/** Keyword + category search over the index (for retrieval / impact analysis). */
export async function searchRequirements(
  companyId: string,
  opts: { query?: string; categories?: string[]; limit?: number } = {}
) {
  const terms = (opts.query ?? "")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .slice(0, 8);

  return db.requirementDoc.findMany({
    where: {
      companyId,
      ...(opts.categories?.length ? { category: { in: opts.categories } } : {}),
      ...(terms.length
        ? {
            OR: terms.flatMap((t) => [
              { title: { contains: t } },
              { body: { contains: t } },
              { codeAreas: { contains: t } },
            ]),
          }
        : {}),
    },
    take: opts.limit ?? 20,
    orderBy: { updatedAt: "desc" },
  });
}

/** Find requirements that govern any of the given code paths (impact analysis). */
export async function requirementsForCodeAreas(companyId: string, paths: string[]) {
  const wanted = paths.map((p) => p.trim()).filter(Boolean).slice(0, 30);
  if (wanted.length === 0) return [];
  return db.requirementDoc.findMany({
    where: {
      companyId,
      OR: wanted.map((p) => ({ codeAreas: { contains: p } })),
    },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
}
