import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { statusLabel } from "@/lib/pipeline-view";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();

  const [total, awaiting, done, recent, company, memberCount] = await Promise.all([
    db.request.count({ where: { companyId: user.companyId } }),
    db.request.count({
      where: { companyId: user.companyId, status: "AWAITING_APPROVAL" },
    }),
    db.request.count({ where: { companyId: user.companyId, status: "DONE" } }),
    db.request.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.company.findUnique({ where: { id: user.companyId } }),
    db.membership.count({ where: { companyId: user.companyId } }),
  ]);

  return (
    <div>
      <div className="row">
        <h2 style={{ margin: 0 }}>Dashboard</h2>
        <div className="spacer" />
        <Link href="/requests/new" className="btn">
          New request
        </Link>
      </div>

      {!company?.githubConnected && (
        <div className="notice">
          GitHub isn't connected yet. Connect it in{" "}
          <Link href="/settings">Settings</Link> so the pipeline can open PRs
          against your repo.
        </div>
      )}

      <div className="grid cols-2">
        <div className="card">
          <div className="muted small">Requests awaiting your approval</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{awaiting}</div>
        </div>
        <div className="card">
          <div className="muted small">Completed (PR opened)</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{done}</div>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>Recent requests</h3>
          <div className="spacer" />
          <span className="small muted">
            {total} total · {memberCount} member{memberCount === 1 ? "" : "s"}
          </span>
        </div>
        {recent.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Nothing yet. <Link href="/requests/new">File your first request →</Link>
          </p>
        ) : (
          <table>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requests/${r.id}`}>{r.title}</Link>
                  </td>
                  <td style={{ width: 160 }}>
                    <span className="badge status">{statusLabel(r.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
