import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import { disconnectGithub, setDefaultRepo } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const user = await requireUser();
  const manage = can.manageCompany(user.role);
  const company = await db.company.findUnique({ where: { id: user.companyId } });

  return (
    <div>
      <h2>Settings</h2>

      {searchParams.connected && (
        <div className="notice">GitHub connected successfully.</div>
      )}
      {searchParams.error && (
        <div className="notice" style={{ borderLeftColor: "var(--danger)" }}>
          GitHub connection error: {searchParams.error}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Company</h3>
        <p className="small muted">
          Name: {company?.name} · Slug: <span className="mono">{company?.slug}</span>
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>GitHub connection</h3>
        {!features.github && (
          <div className="notice">
            Set <span className="mono">GITHUB_CLIENT_ID</span> and{" "}
            <span className="mono">GITHUB_CLIENT_SECRET</span> to enable GitHub
            OAuth. See <span className="mono">.env.example</span>.
          </div>
        )}

        {company?.githubConnected ? (
          <div>
            <p>
              Connected as{" "}
              <span className="mono">@{company.githubLogin ?? "unknown"}</span>. The
              PR agent will open pull requests using this account.
            </p>
            {manage && (
              <>
                <form action={setDefaultRepo} className="row" style={{ marginBottom: 12 }}>
                  <input
                    name="repo"
                    placeholder="owner/repo"
                    defaultValue={company.githubDefaultRepo ?? ""}
                    style={{ maxWidth: 320 }}
                  />
                  <button className="btn secondary" type="submit">
                    Save default repo
                  </button>
                </form>
                <form action={disconnectGithub}>
                  <button className="btn danger small" type="submit">
                    Disconnect GitHub
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          <div>
            <p className="muted">
              Connect GitHub so the pipeline can open PRs against your repository.
            </p>
            {manage ? (
              <a
                className="btn"
                href={features.github ? "/api/oauth/github/start" : undefined}
                aria-disabled={!features.github}
              >
                Connect GitHub
              </a>
            ) : (
              <p className="small muted">
                Ask an owner or admin to connect GitHub.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agents</h3>
        <p className="small muted">
          Acceptance-criteria drafting uses Claude (Sonnet) when{" "}
          <span className="mono">ANTHROPIC_API_KEY</span> is set — currently{" "}
          <strong>{features.anthropic ? "enabled" : "using the template fallback"}</strong>.
          UX-check (Playwright), planner, builder, and tester run as structured
          stubs in this build.
        </p>
      </div>
    </div>
  );
}
