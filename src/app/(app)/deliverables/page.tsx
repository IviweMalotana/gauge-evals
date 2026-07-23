import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { can } from "@/lib/auth";
import { db } from "@/lib/db";
import { DELIVERABLE_KINDS, kindMeta } from "@/lib/deliverables/kinds";
import { NewDeliverableForm } from "@/components/NewDeliverableForm";

export const dynamic = "force-dynamic";

/**
 * PM Deliverables home: generate a new deliverable from the hybrid methodology
 * catalog (PMBOK / Lean Six Sigma / Agile) and browse everything the workspace
 * has produced. Each deliverable is editable in-app and shareable as a
 * standalone HTML page.
 */
export default async function DeliverablesPage() {
  const user = await requireUser();

  const [deliverables, requests] = await Promise.all([
    db.deliverable.findMany({
      where: { companyId: user.companyId },
      orderBy: { updatedAt: "desc" },
      include: { request: { select: { title: true } } },
    }),
    db.request.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
      take: 50,
    }),
  ]);

  return (
    <div>
      <div className="row">
        <h2 style={{ margin: 0 }}>Deliverables</h2>
        <div className="spacer" />
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Project-management documents generated from your workspace — charters,
        RACI matrices, and risk registers (PMBOK), DMAIC improvement plans
        (Lean Six Sigma), status reports and retrospectives (Agile). Every
        deliverable can be adjusted in place and shared across teams as a
        standalone page.
      </p>

      {can.runPipeline(user.role) && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>New deliverable</h3>
          <NewDeliverableForm
            kinds={DELIVERABLE_KINDS.map((k) => ({
              kind: k.kind,
              label: k.label,
              methodology: k.methodology,
              description: k.description,
            }))}
            requests={requests}
          />
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>All deliverables</h3>
        {deliverables.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nothing yet. Generate your first deliverable above.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Version</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d) => {
                const meta = kindMeta(d.kind);
                return (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/deliverables/${d.id}`}>{d.title}</Link>
                    </td>
                    <td>
                      <span className="badge status">{meta?.label ?? d.kind}</span>{" "}
                      <span className="small muted">{meta?.methodology}</span>
                    </td>
                    <td className="small muted">
                      {d.request ? d.request.title : "Workspace"}
                    </td>
                    <td className="small muted">v{d.version}</td>
                    <td className="small muted">
                      {d.updatedAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
