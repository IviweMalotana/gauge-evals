"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can, hashPassword } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/domain";

const addSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "COLLABORATOR", "STAKEHOLDER"]),
});

export type MemberActionState = { error?: string; ok?: string } | undefined;

/**
 * Add a collaborator to the company. If the person already has an account we
 * attach a membership; otherwise we create a lightweight account (no password —
 * they set one via a future invite flow). Returns a temp password to share when
 * a brand-new account is created.
 */
export async function addMember(
  _prev: MemberActionState,
  formData: FormData
): Promise<MemberActionState> {
  const actor = await requireUser();
  if (!can.manageMembers(actor.role)) {
    return { error: "You don't have permission to manage members." };
  }

  const parsed = addSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, name, role } = parsed.data;

  let user = await db.user.findUnique({ where: { email } });
  let tempPassword: string | null = null;

  if (!user) {
    // Deterministic-ish placeholder password the admin shares out-of-band.
    tempPassword = `gauge-${Buffer.from(email).toString("hex").slice(0, 8)}`;
    user = await db.user.create({
      data: { email, name: name ?? null, passwordHash: await hashPassword(tempPassword) },
    });
  }

  const existing = await db.membership.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: actor.companyId } },
  });
  if (existing) {
    return { error: "That person is already a member of this company." };
  }

  await db.membership.create({
    data: { userId: user.id, companyId: actor.companyId, role },
  });

  revalidatePath("/members");
  return {
    ok: tempPassword
      ? `Added ${email}. Temporary password: ${tempPassword}`
      : `Added ${email}.`,
  };
}

export async function changeRole(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!can.manageMembers(actor.role)) return;

  const membershipId = String(formData.get("membershipId"));
  const role = String(formData.get("role")) as Role;
  if (!ROLES.includes(role)) return;

  const membership = await db.membership.findFirst({
    where: { id: membershipId, companyId: actor.companyId },
  });
  if (!membership) return;

  // Don't allow removing the last owner.
  if (membership.role === "OWNER" && role !== "OWNER") {
    const owners = await db.membership.count({
      where: { companyId: actor.companyId, role: "OWNER" },
    });
    if (owners <= 1) return;
  }

  await db.membership.update({ where: { id: membershipId }, data: { role } });
  revalidatePath("/members");
}

export async function removeMember(formData: FormData): Promise<void> {
  const actor = await requireUser();
  if (!can.manageMembers(actor.role)) return;

  const membershipId = String(formData.get("membershipId"));
  const membership = await db.membership.findFirst({
    where: { id: membershipId, companyId: actor.companyId },
  });
  if (!membership) return;
  if (membership.userId === actor.id) return; // can't remove yourself here
  if (membership.role === "OWNER") {
    const owners = await db.membership.count({
      where: { companyId: actor.companyId, role: "OWNER" },
    });
    if (owners <= 1) return;
  }

  await db.membership.delete({ where: { id: membershipId } });
  revalidatePath("/members");
}
