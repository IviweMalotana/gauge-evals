"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";

export async function updateProfile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const first = String(formData.get("firstName") ?? "").trim();
  const last = String(formData.get("lastName") ?? "").trim();
  const name = [first, last].filter(Boolean).join(" ") || null;
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return;

  await db.user.update({
    where: { id: user.id },
    data: { name, email },
  });

  revalidatePath("/settings/profile");
}
