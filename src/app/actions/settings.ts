"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import { enqueueCompanyJob } from "@/lib/queue";
import { addCompanyRepo, removeCompanyRepo, setCompanyDefaultRepo } from "@/lib/repos";

/** Attach a repository to the company (from the picker or a typed owner/name). */
export async function addRepo(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  // The picker submits `repoSelect`; the free-text box submits `repo`.
  const picked = String(formData.get("repoSelect") ?? "").trim();
  const typed = String(formData.get("repo") ?? "").trim();
  const fullName = picked && picked !== "__manual__" ? picked : typed;
  if (fullName) await addCompanyRepo(user.companyId, fullName);
  revalidatePath("/settings");
}

/** Make a connected repo the company default. */
export async function setDefaultRepo(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const repoId = String(formData.get("repoId") ?? "");
  if (repoId) await setCompanyDefaultRepo(user.companyId, repoId);
  revalidatePath("/settings");
}

/** Detach a repo from the company. */
export async function removeRepo(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const repoId = String(formData.get("repoId") ?? "");
  if (repoId) await removeCompanyRepo(user.companyId, repoId);
  revalidatePath("/settings");
}

export async function setAppUrl(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const raw = String(formData.get("appBaseUrl") ?? "").trim();
  // Only accept http(s) URLs; store null when cleared or invalid.
  const valid = /^https?:\/\/\S+$/i.test(raw) ? raw.replace(/\/+$/, "") : null;
  await db.company.update({
    where: { id: user.companyId },
    data: { appBaseUrl: valid },
  });
  revalidatePath("/settings");
}

export async function setPreviewTemplate(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const raw = String(formData.get("previewUrlTemplate") ?? "").trim();
  // Require an http(s) template that includes the {branch} placeholder.
  const valid = /^https?:\/\/\S*\{branch\}\S*$/i.test(raw) ? raw : null;
  await db.company.update({
    where: { id: user.companyId },
    data: { previewUrlTemplate: valid },
  });
  revalidatePath("/settings");
}

/**
 * Kick off seeding the living requirements corpus for the connected repo. Runs
 * in the background (reads the codebase, generates Gherkin, opens a PR). No-op
 * if a seed job is already queued/running so a double-click can't double-seed.
 */
export async function seedRequirements(): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const company = await db.company.findUnique({ where: { id: user.companyId } });
  if (!company?.githubConnected || !company.githubAccessToken || !company.githubDefaultRepo) return;
  if (!features.anthropic) return;

  const inFlight = await db.job.findFirst({
    where: { companyId: user.companyId, kind: "seed_requirements", status: { in: ["queued", "running"] } },
  });
  if (inFlight) return;

  await enqueueCompanyJob("seed_requirements", user.companyId);
  revalidatePath("/settings");
}

/**
 * Kick off design-system extraction for the connected repo (background):
 * reads the UI code, learns the component library, opens a PR with the catalog
 * + design-category requirements. No-op if one is already queued/running.
 */
export async function extractDesign(): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const company = await db.company.findUnique({ where: { id: user.companyId } });
  if (!company?.githubConnected || !company.githubAccessToken || !company.githubDefaultRepo) return;
  if (!features.anthropic) return;

  const inFlight = await db.job.findFirst({
    where: { companyId: user.companyId, kind: "extract_design", status: { in: ["queued", "running"] } },
  });
  if (inFlight) return;

  await enqueueCompanyJob("extract_design", user.companyId);
  revalidatePath("/settings");
}

export async function disconnectGithub(): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  await db.repo.deleteMany({ where: { companyId: user.companyId } });
  await db.company.update({
    where: { id: user.companyId },
    data: {
      githubConnected: false,
      githubLogin: null,
      githubAccessToken: null,
      githubDefaultRepo: null,
    },
  });
  revalidatePath("/settings");
}
