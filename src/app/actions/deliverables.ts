"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import {
  isDeliverableKind,
  type DeliverableSection,
  type DeliverableTable,
} from "@/lib/deliverables/kinds";
import {
  buildGenerationContext,
  generateDeliverable,
} from "@/lib/agents/deliverables";

/**
 * Server actions for PM deliverables: generate, adjust, regenerate, delete.
 * Generation runs inline (a single model call with a deterministic fallback),
 * unlike the multi-stage request pipeline which goes through the job queue.
 */

export type DeliverableActionState = { error?: string } | undefined;

export async function createDeliverable(
  _prev: DeliverableActionState,
  formData: FormData
): Promise<DeliverableActionState> {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) {
    return { error: "Stakeholders can view deliverables but not create them." };
  }

  const kind = String(formData.get("kind") ?? "");
  if (!isDeliverableKind(kind)) return { error: "Pick a deliverable type." };

  const requestIdRaw = String(formData.get("requestId") ?? "").trim();
  let requestId: string | null = null;
  if (requestIdRaw) {
    const request = await db.request.findFirst({
      where: { id: requestIdRaw, companyId: user.companyId },
      select: { id: true },
    });
    if (!request) return { error: "That request doesn't exist in this workspace." };
    requestId = request.id;
  }

  const ctx = await buildGenerationContext(user.companyId, requestId);
  const { content, model } = await generateDeliverable(kind, ctx);

  const deliverable = await db.deliverable.create({
    data: {
      companyId: user.companyId,
      requestId,
      kind,
      title: content.title,
      summary: content.summary,
      sections: JSON.stringify(content.sections),
      tables: JSON.stringify(content.tables),
      model,
      createdById: user.id,
    },
  });

  revalidatePath("/deliverables");
  redirect(`/deliverables/${deliverable.id}`);
}

/** Persist a reviewer's adjustments from the edit form. */
export async function updateDeliverable(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) redirect("/deliverables");

  const id = String(formData.get("id"));
  const existing = await db.deliverable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) redirect("/deliverables");

  const title = String(formData.get("title") ?? "").trim() || existing.title;
  const summary = String(formData.get("summary") ?? "").trim();

  // Sections arrive as section-<i>-heading / section-<i>-body pairs (plus one
  // blank spare row for adding a section); blanks are dropped.
  const sectionCount = Number(formData.get("sectionCount") ?? 0);
  const sections: DeliverableSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const heading = String(formData.get(`section-${i}-heading`) ?? "").trim();
    const body = String(formData.get(`section-${i}-body`) ?? "").trim();
    if (heading || body) sections.push({ heading, body });
  }

  // Each table is one textarea: first line headers, then one line per row,
  // cells separated by " | ".
  const tableCount = Number(formData.get("tableCount") ?? 0);
  const tables: DeliverableTable[] = [];
  for (let i = 0; i < tableCount; i++) {
    const tableTitle = String(formData.get(`table-${i}-title`) ?? "").trim();
    const raw = String(formData.get(`table-${i}-data`) ?? "").trim();
    if (!raw) continue;
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const headers = splitCells(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const cells = splitCells(line);
      // Pad/trim so every row matches the header width.
      return headers.map((_, c) => cells[c] ?? "");
    });
    if (headers.length > 0) tables.push({ title: tableTitle, headers, rows });
  }

  await db.deliverable.update({
    where: { id },
    data: {
      title,
      summary,
      sections: JSON.stringify(sections),
      tables: JSON.stringify(tables),
      version: { increment: 1 },
    },
  });

  revalidatePath(`/deliverables/${id}`);
  revalidatePath("/deliverables");
  redirect(`/deliverables/${id}`);
}

function splitCells(line: string): string[] {
  return line.split("|").map((c) => c.trim());
}

/** Re-run generation with fresh workspace context; keeps the share link stable. */
export async function regenerateDeliverable(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) redirect("/deliverables");

  const id = String(formData.get("id"));
  const existing = await db.deliverable.findFirst({
    where: { id, companyId: user.companyId },
  });
  if (!existing) redirect("/deliverables");
  if (!isDeliverableKind(existing.kind)) redirect("/deliverables");

  const ctx = await buildGenerationContext(user.companyId, existing.requestId);
  const { content, model } = await generateDeliverable(existing.kind, ctx);

  await db.deliverable.update({
    where: { id },
    data: {
      title: content.title,
      summary: content.summary,
      sections: JSON.stringify(content.sections),
      tables: JSON.stringify(content.tables),
      model,
      version: { increment: 1 },
    },
  });

  revalidatePath(`/deliverables/${id}`);
  revalidatePath("/deliverables");
  redirect(`/deliverables/${id}`);
}

export async function deleteDeliverable(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) redirect("/deliverables");

  const id = String(formData.get("id"));
  await db.deliverable.deleteMany({ where: { id, companyId: user.companyId } });

  revalidatePath("/deliverables");
  redirect("/deliverables");
}
