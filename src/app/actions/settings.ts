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
