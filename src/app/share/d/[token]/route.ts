import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kindMeta, parseContent } from "@/lib/deliverables/kinds";
import { renderStandaloneHtml } from "@/lib/deliverables/html";

export const dynamic = "force-dynamic";

/**
 * Public, read-only view of a deliverable as a standalone HTML page. The
 * unguessable share token is the credential — no login required, so documents
 * can be shared across teams (and outside the company) with a single link.
 * The link is stable across edits and always serves the latest version.
 */
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const deliverable = await db.deliverable.findUnique({
    where: { shareToken: params.token },
    include: {
      company: { select: { name: true } },
      request: { select: { title: true } },
    },
  });
  if (!deliverable) {
    return new NextResponse("Not found", { status: 404 });
  }

  const meta = kindMeta(deliverable.kind);
  const html = renderStandaloneHtml(parseContent(deliverable), {
    companyName: deliverable.company.name,
    kindLabel: meta?.label ?? deliverable.kind,
    methodology: meta?.methodology ?? "",
    version: deliverable.version,
    updatedAt: deliverable.updatedAt,
    requestTitle: deliverable.request?.title ?? null,
  });

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Shared docs shouldn't be indexed or cached stale.
      "x-robots-tag": "noindex",
      "cache-control": "no-store",
    },
  });
}
