import { db } from "./db";

/**
 * Connected-repository helpers.
 *
 * A company connects GitHub once (OAuth) and can attach several repositories.
 * One is the default; a request may target a specific connected repo, else the
 * pipeline uses the default. `Company.githubDefaultRepo` mirrors the default
 * repo's fullName so existing reads keep working.
 */

/** Validate + normalize an "owner/name" repo identifier; null if malformed. */
export function normalizeRepoFullName(input: string | null | undefined): string | null {
  const s = (input ?? "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  // owner/name — each segment is GitHub-legal (alnum, -, _, .), exactly one slash.
  return /^[\w.-]+\/[\w.-]+$/.test(s) ? s : null;
}

/**
 * Choose the repo a request runs against: its explicit repo if that repo is
 * still connected to the company, otherwise the company default. Pure.
 */
export function resolveRepoForRequest(
  requestRepo: string | null | undefined,
  connected: string[],
  defaultRepo: string | null | undefined
): string | null {
  if (requestRepo && connected.includes(requestRepo)) return requestRepo;
  return defaultRepo ?? null;
}

/**
 * Ensure the Repo table reflects a company that only has the legacy single
 * `githubDefaultRepo` set — backfill one default Repo row so the multi-repo UI
 * and pipeline have a consistent source of truth. Idempotent.
 */
export async function ensureReposBackfilled(company: {
  id: string;
  githubDefaultRepo: string | null;
}): Promise<void> {
  const count = await db.repo.count({ where: { companyId: company.id } });
  if (count > 0) return;
  const fullName = normalizeRepoFullName(company.githubDefaultRepo);
  if (!fullName) return;
  await db.repo.create({ data: { companyId: company.id, fullName, isDefault: true } });
}

/** All connected repos for a company, default first. */
export async function listCompanyRepos(companyId: string) {
  return db.repo.findMany({
    where: { companyId },
    orderBy: [{ isDefault: "desc" }, { fullName: "asc" }],
  });
}

/** Add a connected repo; the first one added becomes the default. */
export async function addCompanyRepo(companyId: string, rawFullName: string): Promise<void> {
  const fullName = normalizeRepoFullName(rawFullName);
  if (!fullName) return;
  const existing = await db.repo.findUnique({
    where: { companyId_fullName: { companyId, fullName } },
  });
  if (existing) return;
  const count = await db.repo.count({ where: { companyId } });
  const isDefault = count === 0;
  await db.repo.create({ data: { companyId, fullName, isDefault } });
  if (isDefault) {
    await db.company.update({ where: { id: companyId }, data: { githubDefaultRepo: fullName } });
  }
}

/** Make one connected repo the company default (and mirror it on Company). */
export async function setCompanyDefaultRepo(companyId: string, repoId: string): Promise<void> {
  const repo = await db.repo.findFirst({ where: { id: repoId, companyId } });
  if (!repo) return;
  await db.$transaction([
    db.repo.updateMany({ where: { companyId }, data: { isDefault: false } }),
    db.repo.update({ where: { id: repo.id }, data: { isDefault: true } }),
    db.company.update({ where: { id: companyId }, data: { githubDefaultRepo: repo.fullName } }),
  ]);
}

/** Remove a connected repo; if it was the default, promote another (or clear). */
export async function removeCompanyRepo(companyId: string, repoId: string): Promise<void> {
  const repo = await db.repo.findFirst({ where: { id: repoId, companyId } });
  if (!repo) return;
  await db.repo.delete({ where: { id: repo.id } });
  if (repo.isDefault) {
    const next = await db.repo.findFirst({ where: { companyId }, orderBy: { createdAt: "asc" } });
    if (next) {
      await db.repo.update({ where: { id: next.id }, data: { isDefault: true } });
      await db.company.update({ where: { id: companyId }, data: { githubDefaultRepo: next.fullName } });
    } else {
      await db.company.update({ where: { id: companyId }, data: { githubDefaultRepo: null } });
    }
  }
}
