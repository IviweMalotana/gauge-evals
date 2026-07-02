import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { statusLabel } from "@/lib/pipeline-view";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const user = await requireUser();
  const requests = await db.request.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Requests</h2>
        <div className="spacer" />
        <Link href="/requests/new" className="btn">
          New request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No requests yet. File one and the pipeline will run a UX check and draft a
            BRD for review.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Filed by</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requests/${r.id}`}>{r.title}</Link>
                  </td>
                  <td>
                    <span className={`badge ${r.type.toLowerCase()}`}>{r.type}</span>
                  </td>
                  <td>
                    <span className="badge status">{statusLabel(r.status)}</span>
                  </td>
                  <td className="small muted">
                    {r.createdBy.name ?? r.createdBy.email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
