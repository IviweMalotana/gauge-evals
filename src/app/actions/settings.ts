"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";

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
