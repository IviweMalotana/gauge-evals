import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { PIPELINE_STEPS, isActive, statusLabel, stepState } from "@/lib/pipeline-view";
import { BrdApproval } from "@/components/BrdApproval";
import { AutoRefresh } from "@/components/AutoRefresh";
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

function parseObjects(json: string | null | undefined): Record<string, unknown>[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
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
      impact: true,
      plan: true,
      build: true,
      checks: true,
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

  const CHECK_META: Record<string, string> = {
    acceptance: "Acceptance (UX)",
    bugfix: "Bug-fix review",
    regression: "Regression",
  };
  const checkOrder = ["acceptance", "bugfix", "regression"];
  const checks = [...request.checks].sort(
    (a, b) => checkOrder.indexOf(a.kind) - checkOrder.indexOf(b.kind)
  );

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

      {/* Live-refresh while the background worker advances the pipeline */}
      {isActive(request.status) && <AutoRefresh />}

      {/* Pipeline progress */}
      <div className="card">
        {isActive(request.status) && (
          <div className="notice" style={{ borderLeftColor: "var(--accent)", marginBottom: 12 }}>
            Working… the pipeline is running in the background. This page updates
            automatically.
          </div>
        )}
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

      {/* Impact on the requirements corpus */}
      {request.impact && (() => {
        const related = parseObjects(request.impact.related) as {
          reqId: string;
          title: string;
          category: string;
          filePath: string;
          affected: boolean;
          reason: string;
        }[];
        const drafts = parseObjects(request.impact.drafts) as {
          op: string;
          reqId: string;
          category: string;
          title: string;
          filePath: string;
          body: string;
        }[];
        if (related.length === 0 && drafts.length === 0 && !request.impact.summary) return null;
        return (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Impact on requirements</h3>
            {request.impact.summary && <p>{request.impact.summary}</p>}

            {related.length > 0 && (
              <>
                <h4>Related requirements</h4>
                <ul className="small">
                  {related.map((r) => (
                    <li key={r.reqId}>
                      <span className={`badge ${r.affected ? "bug" : ""}`}>
                        {r.affected ? "AFFECTED" : "related"}
                      </span>{" "}
                      <span className="mono">{r.reqId}</span> [{r.category}] {r.title}
                      {r.reason ? <span className="muted"> — {r.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {drafts.length > 0 && (
              <>
                <h4>Drafted requirement changes</h4>
                <p className="small muted">
                  Committed to the build branch alongside the code when this is approved.
                </p>
                {drafts.map((d) => (
                  <details key={d.filePath} style={{ marginBottom: 8 }}>
                    <summary>
                      <span className={`badge ${d.op === "new" ? "feature" : "status"}`}>
                        {d.op === "new" ? "NEW" : "UPDATE"}
                      </span>{" "}
                      <span className="mono">{d.filePath}</span> — {d.title}
                    </summary>
                    <pre>{`Feature: ${d.title}\n\n${d.body}`}</pre>
                  </details>
                ))}
              </>
            )}
          </div>
        );
      })()}

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

      {checks.map((c) => {
        const shots = parseArray(c.screenshots);
        return (
          <div className="card" key={c.id}>
            <h3 style={{ marginTop: 0 }}>{CHECK_META[c.kind] ?? c.kind}</h3>
            <p>
              <span className={`badge ${c.passed ? "feature" : "bug"}`}>
                {c.passed ? "PASSED" : "FAILED"}
              </span>{" "}
              {c.summary}
            </p>
            <pre>{parseArray(c.output).join("\n")}</pre>
            {shots.length > 0 && (
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {shots.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer">
                    <img
                      src={src}
                      alt="verification screenshot"
                      style={{
                        maxWidth: 220,
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                      }}
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}

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
