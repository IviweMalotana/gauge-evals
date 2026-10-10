"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function updatePassword(formData: FormData): Promise<void> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!current || !next || next !== confirm || next.length < 6) return;

  const dbUser = await db.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.passwordHash) return;

  const valid = await verifyPassword(current, dbUser.passwordHash);
  if (!valid) return;

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  revalidatePath("/settings/security");
}
