"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/crypto";
import { verifyConnection, listProjects } from "@/lib/jira/client";

/**
 * Verify Jira credentials, store them (encrypted when AUTH_SECRET is set),
 * and bounce back to the integrations hub. We verify FIRST — the UI must
 * tell the user "that token doesn't reach the account you named" before any
 * cipher lands in the database.
 */
export async function connectJira(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const apiToken = String(formData.get("apiToken") ?? "").trim();
  if (!baseUrl || !email || !apiToken) {
    throw new Error("Site URL, email, and API token are all required.");
  }

  // Prove the creds work before persisting anything.
  const me = await verifyConnection({ baseUrl, email, apiToken });
  if (!me?.accountId) throw new Error("Jira verification returned no account.");

  const cipher = env.AUTH_SECRET ? encryptSecret(apiToken) : apiToken;
  await db.jiraConnection.upsert({
    where: { companyId: user.companyId },
    create: {
      companyId: user.companyId,
      baseUrl,
      email,
      apiTokenCipher: cipher,
    },
    update: { baseUrl, email, apiTokenCipher: cipher },
  });

  revalidatePath("/integrations");
  redirect("/integrations");
}

export async function disconnectJira(): Promise<void> {
  const user = await requireUser();
  if (!can.manageCompany(user.role)) return;
  await db.jiraConnection
    .delete({ where: { companyId: user.companyId } })
    .catch(() => null);
  revalidatePath("/integrations");
}

/**
 * Pull the Jira projects list on demand (no state kept) so the picker page
 * can show the user what to attach to a Baton Project.
 */
export async function fetchJiraProjects(): Promise<
  Array<{ key: string; name: string }>
> {
  const user = await requireUser();
  const row = await db.jiraConnection.findUnique({
    where: { companyId: user.companyId },
  });
  if (!row) return [];
  const { openConnection } = await import("@/lib/jira/client");
  const cfg = openConnection(row);
  const projects = await listProjects(cfg);
  return projects.map((p) => ({ key: p.key, name: p.name }));
}
