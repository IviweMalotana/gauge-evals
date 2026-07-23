import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { db } from "@/lib/db";
import { kindMeta, parseContent } from "@/lib/deliverables/kinds";
import { updateDeliverable } from "@/app/actions/deliverables";

export const dynamic = "force-dynamic";

/**
 * Adjust a deliverable in place. Sections edit as heading + body pairs (one
 * blank spare row lets you add a section); each table edits as plain text —
 * first line headers, one line per row, cells separated by " | ".
 */
export default async function EditDeliverablePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  if (!can.runPipeline(user.role)) redirect(`/deliverables/${params.id}`);

  const deliverable = await db.deliverable.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!deliverable) notFound();

  const meta = kindMeta(deliverable.kind);
  const content = parseContent(deliverable);
  // One spare blank section row so a new section can be added without JS.
  const sections = [...content.sections, { heading: "", body: "" }];

  return (
    <div>
      <h2 style={{ margin: 0 }}>Adjust: {content.title}</h2>
      <p className="small muted" style={{ marginTop: 6 }}>
        {meta?.label} · {meta?.methodology} · saving bumps the version; the
        share link keeps working and always shows the latest version.
      </p>

      <form action={updateDeliverable}>
        <input type="hidden" name="id" value={deliverable.id} />
        <input type="hidden" name="sectionCount" value={sections.length} />
        <input type="hidden" name="tableCount" value={content.tables.length} />

        <div className="card">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={content.title} required />

          <label htmlFor="summary">Executive summary</label>
          <textarea id="summary" name="summary" defaultValue={content.summary} />
        </div>

        {sections.map((s, i) => (
          <div className="card" key={`s-${i}`}>
            <label htmlFor={`section-${i}-heading`}>
              {i < content.sections.length
                ? `Section ${i + 1} heading`
                : "New section heading (leave blank to skip)"}
            </label>
            <input
              id={`section-${i}-heading`}
              name={`section-${i}-heading`}
              defaultValue={s.heading}
            />
            <label htmlFor={`section-${i}-body`}>Body</label>
            <textarea
              id={`section-${i}-body`}
              name={`section-${i}-body`}
              defaultValue={s.body}
            />
          </div>
        ))}

        {content.tables.map((t, i) => (
          <div className="card" key={`t-${i}`}>
            <label htmlFor={`table-${i}-title`}>Table {i + 1} title</label>
            <input
              id={`table-${i}-title`}
              name={`table-${i}-title`}
              defaultValue={t.title}
            />
            <label htmlFor={`table-${i}-data`}>
              Rows — first line is the header; separate cells with {" | "}
            </label>
            <textarea
              id={`table-${i}-data`}
              name={`table-${i}-data`}
              className="mono"
              style={{ minHeight: 160 }}
              defaultValue={[
                t.headers.join(" | "),
                ...t.rows.map((r) => r.join(" | ")),
              ].join("\n")}
            />
          </div>
        ))}

        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn" type="submit">
            Save changes
          </button>
          <Link href={`/deliverables/${deliverable.id}`} className="btn secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
