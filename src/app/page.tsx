import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const stages = [
    "UX check",
    "BRD (Given/When/Then)",
    "Human approval",
    "Plan",
    "Build",
    "Test",
    "Pull request",
  ];

  return (
    <div>
      <div className="topbar">
        <span className="brand">⟡ Gauge</span>
        <nav className="row">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="btn" style={{ marginLeft: 16 }}>
            Get started
          </Link>
        </nav>
      </div>
      <div className="container">
        <div className="hero">
          <h1>From stakeholder request to pull request.</h1>
          <p>
            Stakeholders file a request. An agent runs a UX check — reproducing bugs
            by driving the app, or scoping features against the code — then drafts a
            business-facing BRD in plain Given/When/Then. A human approves, and the
            planner, builder, and tester agents take it the rest of the way to an
            open PR.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/register" className="btn">
              Create your company
            </Link>
            <Link href="/login" className="btn secondary">
              Sign in
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>The pipeline</h3>
          <div className="pipeline">
            {stages.map((s) => (
              <span key={s} className="step">
                {s}
              </span>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Acceptance criteria are written by Claude (Sonnet). The human gate sits
            right after the BRD — accept, reject, or alter before any code is touched.
          </p>
        </div>
      </div>
    </div>
  );
}
