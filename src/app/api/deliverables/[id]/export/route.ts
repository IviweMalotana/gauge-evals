import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kindMeta, parseContent } from "@/lib/deliverables/kinds";
import { renderStandaloneHtml } from "@/lib/deliverables/html";

export const dynamic = "force-dynamic";

/** Download a deliverable as a self-contained HTML file (email, wiki, print). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const deliverable = await db.deliverable.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      company: { select: { name: true } },
      request: { select: { title: true } },
    },
  });
  if (!deliverable) return new NextResponse("Not found", { status: 404 });

  const meta = kindMeta(deliverable.kind);
  const html = renderStandaloneHtml(parseContent(deliverable), {
    companyName: deliverable.company.name,
    kindLabel: meta?.label ?? deliverable.kind,
    methodology: meta?.methodology ?? "",
    version: deliverable.version,
    updatedAt: deliverable.updatedAt,
    requestTitle: deliverable.request?.title ?? null,
  });

  const slug =
    deliverable.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "deliverable";

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-v${deliverable.version}.html"`,
    },
  });
}
