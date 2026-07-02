import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { PIPELINE_STEPS, statusLabel, stepState } from "@/lib/pipeline-view";
import { BrdApproval } from "@/components/BrdApproval";
import { retryRequest } from "@/app/actions/requests";

export const dynamic = "force-dynamic";

function parseArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function RequestDetail({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const request = await db.request.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      createdBy: { select: { name: true, email: true } },
      uxCheck: true,
      brd: true,
      plan: true,
      build: true,
      testRun: true,
      pullReq: true,
      approvals: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();

  const criteria = parseArray(request.brd?.acceptanceCriteria);
  const uxSteps = parseArray(request.uxCheck?.steps);
  const planSteps = parseArray(request.plan?.steps);
  const testOutput = parseArray(request.testRun?.output);

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/requests">← Requests</Link>
      </div>
      <div className="row">
        <h2 style={{ margin: 0 }}>{request.title}</h2>
        <div className="spacer" />
        <span className={`badge ${request.type.toLowerCase()}`}>{request.type}</span>
        <span className="badge status">{statusLabel(request.status)}</span>
      </div>
      <p className="muted small">
        Filed by {request.createdBy.name ?? request.createdBy.email} ·{" "}
        {request.priority} priority
      </p>

      {/* Pipeline progress */}
      <div className="card">
        <div className="pipeline">
          {PIPELINE_STEPS.map((s) => {
            const st =
              request.status === "DONE"
                ? "done"
                : stepState(s.status, request.status);
            return (
              <span key={s.key} className={`step ${st}`}>
                {s.label}
              </span>
            );
          })}
        </div>
        {request.status === "FAILED" && (
          <div className="notice" style={{ marginTop: 12 }}>
            A pipeline stage failed. See the activity log below.
            <form action={retryRequest} style={{ marginTop: 8 }}>
              <input type="hidden" name="requestId" value={request.id} />
              <button className="btn secondary small" type="submit">
                Restart pipeline
              </button>
            </form>
          </div>
        )}
        {request.status === "REJECTED" && (
          <div className="notice" style={{ marginTop: 12 }}>
            The BRD was rejected. No code was touched.
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Original request</h3>
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{request.description}</p>
      </div>

      {/* UX check */}
      {request.uxCheck && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>UX check</h3>
          <p>
            <span className={`badge ${request.uxCheck.classifiedType.toLowerCase()}`}>
              {request.uxCheck.classifiedType}
            </span>{" "}
            {request.uxCheck.classifiedType === "BUG" && (
              <span className="badge">
                {request.uxCheck.reproduced ? "Reproduced" : "Not reproduced"}
              </span>
            )}
          </p>
          <p>{request.uxCheck.summary}</p>
          {uxSteps.length > 0 && (
            <ol className="small muted">
              {uxSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* BRD */}
      {request.brd && (
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>Business Requirements (BRD)</h3>
            <div className="spacer" />
            <span className="small muted">
              v{request.brd.version} · {request.brd.model}
            </span>
          </div>
          <p style={{ whiteSpace: "pre-wrap" }}>{request.brd.narrative}</p>

          <h4>Scenarios</h4>
          <pre>{request.brd.gherkin}</pre>

          {criteria.length > 0 && (
            <>
              <h4>Acceptance criteria</h4>
              <ul>
                {criteria.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Human gate */}
      {request.status === "AWAITING_APPROVAL" && request.brd && (
        <BrdApproval
          requestId={request.id}
          narrative={request.brd.narrative}
          gherkin={request.brd.gherkin}
        />
      )}

      {/* Approval history */}
      {request.approvals.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Decisions</h3>
          {request.approvals.map((a) => (
            <p key={a.id} className="small">
              <span className="badge status">{a.decision}</span>{" "}
              {a.user.name ?? a.user.email}
              {a.note ? ` — ${a.note}` : ""}
            </p>
          ))}
        </div>
      )}

      {/* Downstream artifacts */}
      {request.plan && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Plan</h3>
          <p>{request.plan.summary}</p>
          <ol className="small">
            {planSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {request.build && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Build</h3>
          <p>
            {request.build.summary} · branch{" "}
            <span className="mono">{request.build.branch}</span>
          </p>
          <pre>{request.build.diff}</pre>
        </div>
      )}

      {request.testRun && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Tests</h3>
          <p>
            <span className="badge">{request.testRun.passed ? "PASSED" : "FAILED"}</span>{" "}
            {request.testRun.summary}
          </p>
          <pre>{testOutput.join("\n")}</pre>
        </div>
      )}

      {request.pullReq && (
        <div className="card" style={{ borderColor: "var(--accent-2)" }}>
          <h3 style={{ marginTop: 0 }}>Pull request</h3>
          <p>
            <a href={request.pullReq.url} target="_blank" rel="noreferrer">
              {request.pullReq.title}
            </a>
          </p>
        </div>
      )}

      {/* Activity log */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Activity</h3>
        <table>
          <tbody>
            {request.events.map((e) => (
              <tr key={e.id}>
                <td className="small muted mono" style={{ width: 120 }}>
                  {e.stage}
                </td>
                <td className="small" style={{ color: e.level === "error" ? "var(--danger)" : undefined }}>
                  {e.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
