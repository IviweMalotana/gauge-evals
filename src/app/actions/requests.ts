"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { logEvent } from "@/lib/agents/orchestrator";
import { enqueue } from "@/lib/queue";

const createSchema = z.object({
  title: z.string().min(4, "Give the request a clear title"),
  description: z.string().min(10, "Add a bit more detail so the agent can work"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export type ReqActionState = { error?: string } | undefined;

/**
 * File a new request, then kick off phase 1 of the pipeline (UX check → BRD).
 * The pipeline runs inline before redirect; for production you'd move this to a
 * background job/queue.
 */
export async function createRequest(
  _prev: ReqActionState,
  formData: FormData
): Promise<ReqActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") ?? "normal",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const request = await db.request.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      companyId: user.companyId,
      createdById: user.id,
    },
  });
  await logEvent(request.id, "intake", `Request filed by ${user.name ?? user.email}.`);

  // Phase 1 (UX check + BRD) runs in the background; return immediately.
  await enqueue("to_approval", request.id);

  redirect(`/requests/${request.id}`);
}

/** Human decision on the drafted BRD. */
export async function decideBrd(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId"));
  const decision = String(formData.get("decision")) as
    | "ACCEPTED"
    | "REJECTED"
    | "ALTERED";
  const note = (formData.get("note") as string | null)?.trim() || null;

  const request = await db.request.findFirst({
    where: { id: requestId, companyId: user.companyId },
    include: { brd: true },
  });
  if (!request) redirect("/requests");
  if (request.status !== "AWAITING_APPROVAL") {
    // Nothing to decide; avoid double-runs.
    redirect(`/requests/${requestId}`);
  }

  // If the reviewer altered the BRD, persist their edits first.
  if (decision === "ALTERED" && request.brd) {
    const narrative = (formData.get("narrative") as string | null)?.trim();
    const gherkin = (formData.get("gherkin") as string | null)?.trim();
    if (narrative || gherkin) {
      await db.brd.update({
        where: { requestId },
        data: {
          narrative: narrative || request.brd.narrative,
          gherkin: gherkin || request.brd.gherkin,
          version: { increment: 1 },
        },
      });
    }
  }

  await db.approval.create({
    data: { requestId, userId: user.id, decision, note },
  });
  await logEvent(
    requestId,
    "approval",
    `${user.name ?? user.email} ${decision.toLowerCase()} the BRD.`,
    note ? { note } : undefined
  );

  if (decision === "REJECTED") {
    await db.request.update({ where: { id: requestId }, data: { status: "REJECTED" } });
    revalidatePath(`/requests/${requestId}`);
    redirect(`/requests/${requestId}`);
  }

  // Accepted or altered → run phase 2 (plan → build → test → PR) in the
  // background.
  await enqueue("after_approval", requestId);
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}

/** Re-run the whole pipeline from scratch (e.g. after a FAILED stage). */
export async function retryRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) redirect("/requests");
  const requestId = String(formData.get("requestId"));
  const request = await db.request.findFirst({
    where: { id: requestId, companyId: user.companyId },
  });
  if (!request) redirect("/requests");

  await logEvent(requestId, "pipeline", "Pipeline restarted from intake.");
  await enqueue("to_approval", requestId);
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}
