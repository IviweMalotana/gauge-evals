import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import {
  disconnectGithub,
  setAppUrl,
  setDefaultRepo,
  setPreviewTemplate,
} from "@/app/actions/settings";

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
        <h3 style={{ marginTop: 0 }}>App under test</h3>
        <p className="small muted">
          The URL of your running app. When a request is a bug, the UX-check
          agent drives a real headless browser against this URL (or a link in the
          request) to look for failure signals and capture a screenshot.
        </p>
        {manage ? (
          <form action={setAppUrl} className="row">
            <input
              name="appBaseUrl"
              placeholder="https://staging.acme.com"
              defaultValue={company?.appBaseUrl ?? ""}
              style={{ maxWidth: 360 }}
            />
            <button className="btn secondary" type="submit">
              Save app URL
            </button>
          </form>
        ) : (
          <p className="small muted">
            {company?.appBaseUrl ? (
              <span className="mono">{company.appBaseUrl}</span>
            ) : (
              "Not set. Ask an owner or admin to add it."
            )}
          </p>
        )}

        <h4 style={{ marginBottom: 4 }}>Per-branch preview URL (optional)</h4>
        <p className="small muted" style={{ marginTop: 0 }}>
          If your host deploys a preview per branch, add its URL template with a{" "}
          <span className="mono">{"{branch}"}</span> placeholder. The tester will
          wait for that preview to come live and verify the{" "}
          <strong>actual change</strong> — bug-fix and regression become real
          verdicts. Without it, tests run against the app URL above.
          <br />
          Examples: <span className="mono">https://app-{"{branch}"}.up.railway.app</span>{" "}
          · <span className="mono">https://{"{repoName}"}-git-{"{branch}"}.vercel.app</span>
        </p>
        {manage ? (
          <form action={setPreviewTemplate} className="row">
            <input
              name="previewUrlTemplate"
              placeholder="https://app-{branch}.up.railway.app"
              defaultValue={company?.previewUrlTemplate ?? ""}
              style={{ maxWidth: 420 }}
              className="mono"
            />
            <button className="btn secondary" type="submit">
              Save preview template
            </button>
          </form>
        ) : (
          <p className="small muted">
            {company?.previewUrlTemplate ? (
              <span className="mono">{company.previewUrlTemplate}</span>
            ) : (
              "Not set."
            )}
          </p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Agents</h3>
        <p className="small muted">
          Acceptance-criteria drafting uses Claude (Sonnet) when{" "}
          <span className="mono">ANTHROPIC_API_KEY</span> is set — currently{" "}
          <strong>{features.anthropic ? "enabled" : "using the template fallback"}</strong>.
          The BRD and planner agents use Claude; the UX-check agent drives a{" "}
          <strong>real headless browser</strong> to reproduce bugs; and when a
          repo is connected the builder agent <strong>writes real code</strong>,
          and — when an app URL is set — the tester{" "}
          <strong>drives a real browser</strong> to perform the acceptance
          criteria as human actions, verifies a reported bug is fixed, and runs a
          regression sweep. The PR agent opens a{" "}
          <strong>real pull request</strong>.
        </p>
      </div>
    </div>
  );
}
