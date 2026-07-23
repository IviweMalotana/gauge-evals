import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { kindMeta, parseContent } from "@/lib/deliverables/kinds";
import { regenerateDeliverable, deleteDeliverable } from "@/app/actions/deliverables";
import { CopyField } from "@/components/CopyField";

export const dynamic = "force-dynamic";

export default async function DeliverablePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const deliverable = await db.deliverable.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { request: { select: { id: true, title: true } } },
  });
  if (!deliverable) notFound();

  const meta = kindMeta(deliverable.kind);
  const content = parseContent(deliverable);
  const shareUrl = `${env.APP_URL}/share/d/${deliverable.shareToken}`;
  const canEdit = can.runPipeline(user.role);

  return (
    <div>
      <div className="row">
        <h2 style={{ margin: 0 }}>{content.title}</h2>
        <div className="spacer" />
        {canEdit && (
          <>
            <Link href={`/deliverables/${deliverable.id}/edit`} className="btn secondary small">
              Adjust
            </Link>
            <form action={regenerateDeliverable}>
              <input type="hidden" name="id" value={deliverable.id} />
              <button className="btn secondary small" type="submit">
                Regenerate
              </button>
            </form>
            <form action={deleteDeliverable}>
              <input type="hidden" name="id" value={deliverable.id} />
              <button className="btn danger small" type="submit">
                Delete
              </button>
            </form>
          </>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 6 }}>
        <span className="badge status">{meta?.label ?? deliverable.kind}</span>{" "}
        <span className="badge">{meta?.methodology}</span> · v{deliverable.version} ·{" "}
        {deliverable.model === "template-fallback"
          ? "template (no API key)"
          : `drafted by ${deliverable.model}`}
        {deliverable.request && (
          <>
            {" "}
            · scoped to{" "}
            <Link href={`/requests/${deliverable.request.id}`}>
              {deliverable.request.title}
            </Link>
          </>
        )}
      </p>

      <div className="card">
        <div className="row">
          <div>
            <strong>Share across teams</strong>
            <div className="small muted">
              Anyone with this link can view the latest version — no login
              needed. It stays stable as you adjust the document.
            </div>
          </div>
          <div className="spacer" />
          <a
            href={`/share/d/${deliverable.shareToken}`}
            target="_blank"
            className="btn secondary small"
          >
            Open share page
          </a>
          <a
            href={`/api/deliverables/${deliverable.id}/export`}
            className="btn secondary small"
          >
            Download HTML
          </a>
        </div>
        <CopyField value={shareUrl} />
      </div>

      {content.summary && (
        <div className="notice" style={{ borderLeftColor: "var(--accent)" }}>
          {content.summary}
        </div>
      )}

      {content.sections.map((s, i) => (
        <div className="card" key={`s-${i}`}>
          <h3 style={{ marginTop: 0 }}>{s.heading}</h3>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{s.body}</p>
        </div>
      ))}

      {content.tables.map((t, i) => (
        <div className="card" key={`t-${i}`}>
          {t.title && <h3 style={{ marginTop: 0 }}>{t.title}</h3>}
          <table>
            <thead>
              <tr>
                {t.headers.map((h, hi) => (
                  <th key={hi}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.rows.map((r, ri) => (
                <tr key={ri}>
                  {t.headers.map((_, ci) => (
                    <td key={ci}>{r[ci] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <p className="small muted">
        <Link href="/deliverables">← All deliverables</Link>
      </p>
    </div>
  );
}
