import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { isActive, needsAttention, statusExplainer, statusLabel } from "@/lib/pipeline-view";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const PIPELINE_SUMMARY =
  "UX check → BRD → your approval → plan → build → verify → pull request";

export default async function RequestsPage() {
  const user = await requireUser();
  const [company, requests] = await Promise.all([
    db.company.findUnique({
      where: { id: user.companyId },
      select: { githubConnected: true, githubDefaultRepo: true },
    }),
    db.request.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        pullReq: { select: { url: true } },
      },
    }),
  ]);

  const anyActive = requests.some((r) => isActive(r.status));
  const counts = {
    active: requests.filter((r) => isActive(r.status)).length,
    awaiting: requests.filter((r) => r.status === "AWAITING_APPROVAL").length,
    done: requests.filter((r) => r.status === "DONE").length,
    failed: requests.filter((r) => r.status === "FAILED").length,
  };

  return (
    <div>
      {anyActive && <AutoRefresh />}

      <div className="row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Requests</h2>
        <div className="spacer" />
        <Link href="/requests/new" className="btn">
          New request
        </Link>
      </div>

      {/* What this page is */}
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>
          Each request runs an automated pipeline:{" "}
          <span className="mono small">{PIPELINE_SUMMARY}</span>. You approve the
          BRD before any code is written; the result is a real pull request on{" "}
          {company?.githubConnected ? (
            <span className="mono">{company.githubDefaultRepo ?? "your repo"}</span>
          ) : (
            <Link href="/settings">a connected repo</Link>
          )}
          .
        </p>
        {requests.length > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            {counts.active} running · {counts.awaiting} awaiting your approval ·{" "}
            {counts.done} done · {counts.failed} failed
            {anyActive && " · this page refreshes automatically while work is running"}
          </p>
        )}
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
                <th>Request</th>
                <th>Type</th>
                <th>Repo</th>
                <th>Where it is</th>
                <th>Filed by</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/requests/${r.id}`}>{r.title}</Link>
                    {needsAttention(r.status) && (
                      <span
                        className={`badge ${r.status === "FAILED" ? "bug" : "status"}`}
                        style={{ marginLeft: 8 }}
                      >
                        {r.status === "FAILED" ? "needs fix" : "needs you"}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.type.toLowerCase()}`}>{r.type}</span>
                  </td>
                  <td className="small mono muted">{r.repoFullName ?? "default"}</td>
                  <td>
                    <div className="row" style={{ gap: 6, alignItems: "center" }}>
                      {isActive(r.status) && <span className="gh-dot gh-dot-on" aria-hidden />}
                      <span className="badge status">{statusLabel(r.status)}</span>
                    </div>
                    <div className="small muted" style={{ marginTop: 2 }}>
                      {r.status === "DONE" && r.pullReq?.url ? (
                        <a href={r.pullReq.url} target="_blank" rel="noreferrer">
                          View the pull request →
                        </a>
                      ) : (
                        statusExplainer(r.status)
                      )}
                    </div>
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
