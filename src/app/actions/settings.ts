"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import { enqueueCompanyJob } from "@/lib/queue";

export async function setDefaultRepo(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  const repo = String(formData.get("repo") ?? "").trim();
  await db.company.update({
    where: { id: user.companyId },
    data: { githubDefaultRepo: repo || null },
  });
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

export async function disconnectGithub(): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  await db.company.update({
    where: { id: user.companyId },
    data: {
      githubConnected: false,
      githubLogin: null,
      githubAccessToken: null,
    },
  });
  revalidatePath("/settings");
}
