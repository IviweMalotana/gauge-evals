import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import { APP_NAME } from "@/lib/brand";
import {
  addRepo,
  disconnectGithub,
  extractDesign,
  removeRepo,
  seedRequirements,
  setAppUrl,
  setDefaultRepo,
  setPreviewTemplate,
} from "@/app/actions/settings";
import { decryptSecret } from "@/lib/crypto";
import { ensureReposBackfilled, listCompanyRepos } from "@/lib/repos";
import { listUserRepos } from "@/lib/github";

export const dynamic = "force-dynamic";

function parseSeedResult(json: string | null): { count?: number; prNumber?: number | null; prUrl?: string | null } {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const user = await requireUser();
  const manage = can.manageCompany(user.role);
  const company = await db.company.findUnique({ where: { id: user.companyId } });

  // Multi-repo: backfill the legacy single default into the Repo table, then
  // load the connected repos and (best-effort) the account's repos for the picker.
  if (company?.githubConnected) {
    await ensureReposBackfilled({ id: company.id, githubDefaultRepo: company.githubDefaultRepo });
  }
  const connectedRepos = company?.githubConnected ? await listCompanyRepos(user.companyId) : [];
  const connectedNames = new Set(connectedRepos.map((r) => r.fullName));
  let pickerRepos: { fullName: string; private: boolean }[] = [];
  if (company?.githubConnected && manage) {
    const token = decryptSecret(company.githubAccessToken);
    if (token) {
      pickerRepos = (await listUserRepos(token).catch(() => []))
        .filter((r) => !connectedNames.has(r.fullName))
        .slice(0, 200);
    }
  }

  const canSeed = Boolean(
    company?.githubConnected && company.githubDefaultRepo && features.anthropic
  );
  const [reqCount, lastSeed] = await Promise.all([
    db.requirementDoc.count({ where: { companyId: user.companyId } }),
    db.job.findFirst({
      where: { companyId: user.companyId, kind: "seed_requirements" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const seedResult = parseSeedResult(lastSeed?.result ?? null);
  const seeding = lastSeed?.status === "queued" || lastSeed?.status === "running";

  const [designCount, lastDesign] = await Promise.all([
    db.requirementDoc.count({ where: { companyId: user.companyId, category: "design" } }),
    db.job.findFirst({
      where: { companyId: user.companyId, kind: "extract_design" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const designResult = parseSeedResult(lastDesign?.result ?? null);
  const extracting = lastDesign?.status === "queued" || lastDesign?.status === "running";

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
            <h4 style={{ marginBottom: 4 }}>Connected repositories</h4>
            <p className="small muted" style={{ marginTop: 0 }}>
              Attach one or more repos. The <strong>default</strong> is used when a
              request doesn't pick a specific repo.
            </p>
            {connectedRepos.length === 0 ? (
              <p className="small muted">No repositories connected yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }}>
                {connectedRepos.map((r) => (
                  <li key={r.id} className="row" style={{ gap: 8, marginBottom: 6, alignItems: "center" }}>
                    <span className="mono">{r.fullName}</span>
                    {r.isDefault && <span className="badge status">default</span>}
                    <div className="spacer" />
                    {manage && !r.isDefault && (
                      <form action={setDefaultRepo}>
                        <input type="hidden" name="repoId" value={r.id} />
                        <button className="btn secondary small" type="submit">
                          Make default
                        </button>
                      </form>
                    )}
                    {manage && (
                      <form action={removeRepo}>
                        <input type="hidden" name="repoId" value={r.id} />
                        <button className="btn danger small" type="submit">
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {manage && (
              <>
                <form action={addRepo} className="row" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  {pickerRepos.length > 0 ? (
                    <select name="repoSelect" defaultValue="" style={{ maxWidth: 320 }}>
                      <option value="" disabled>
                        Pick a repository…
                      </option>
                      {pickerRepos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName}
                          {r.private ? " (private)" : ""}
                        </option>
                      ))}
                      <option value="__manual__">Other — type below…</option>
                    </select>
                  ) : null}
                  <input
                    name="repo"
                    placeholder="owner/repo"
                    style={{ maxWidth: 260 }}
                    className="mono"
                  />
                  <button className="btn secondary" type="submit">
                    Add repository
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
        <h3 style={{ marginTop: 0 }}>Requirements corpus</h3>
        <p className="small muted">
          The living requirements — this repository's behaviour documented as
          version-controlled Cucumber/Gherkin <span className="mono">.feature</span>{" "}
          files (Feature / Scenario / Given-When-Then), the source of truth{" "}
          {APP_NAME} uses for search and per-request impact analysis. Seeding
          reads your codebase, generates a baseline corpus, and opens a PR.
        </p>
        <p className="small">
          Indexed requirements: <strong>{reqCount}</strong>
          {lastSeed && (
            <>
              {" · "}last seed:{" "}
              <span className="mono">{lastSeed.status}</span>
              {lastSeed.status === "done" && seedResult.count != null && (
                <>
                  {" "}({seedResult.count} generated
                  {seedResult.prUrl ? (
                    <>
                      {", "}
                      <a href={seedResult.prUrl} target="_blank" rel="noreferrer">
                        PR{seedResult.prNumber ? ` #${seedResult.prNumber}` : ""}
                      </a>
                    </>
                  ) : null}
                  )
                </>
              )}
              {lastSeed.status === "error" && lastSeed.error && (
                <span className="muted"> — {lastSeed.error}</span>
              )}
            </>
          )}
        </p>

        {manage ? (
          canSeed ? (
            <form action={seedRequirements}>
              <button className="btn secondary" type="submit" disabled={seeding}>
                {seeding
                  ? "Seeding… (a PR will open on your repo)"
                  : reqCount > 0
                    ? "Re-seed requirements corpus"
                    : "Seed requirements corpus"}
              </button>
            </form>
          ) : (
            <p className="small muted">
              Connect GitHub, set a default repo, and configure{" "}
              <span className="mono">ANTHROPIC_API_KEY</span> to enable seeding.
            </p>
          )
        ) : (
          <p className="small muted">Ask an owner or admin to seed the corpus.</p>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Design system</h3>
        <p className="small muted">
          The strict definitions of your UI component library (cards, tables,
          dialogs, buttons, badges…), learned from the codebase. Extraction opens
          a PR with a <span className="mono">design/components.md</span> catalog
          and a design-category requirement per component, which {APP_NAME}'s UI
          checks enforce.
        </p>
        <p className="small">
          Design components indexed: <strong>{designCount}</strong>
          {lastDesign && (
            <>
              {" · "}last extract: <span className="mono">{lastDesign.status}</span>
              {lastDesign.status === "done" && designResult.count != null && (
                <>
                  {" "}({designResult.count} components
                  {designResult.prUrl ? (
                    <>
                      {", "}
                      <a href={designResult.prUrl} target="_blank" rel="noreferrer">
                        PR{designResult.prNumber ? ` #${designResult.prNumber}` : ""}
                      </a>
                    </>
                  ) : null}
                  )
                </>
              )}
              {lastDesign.status === "error" && lastDesign.error && (
                <span className="muted"> — {lastDesign.error}</span>
              )}
            </>
          )}
        </p>
        {manage ? (
          canSeed ? (
            <form action={extractDesign}>
              <button className="btn secondary" type="submit" disabled={extracting}>
                {extracting
                  ? "Extracting… (a PR will open on your repo)"
                  : designCount > 0
                    ? "Re-extract design system"
                    : "Extract design system"}
              </button>
            </form>
          ) : (
            <p className="small muted">
              Connect GitHub, set a default repo, and configure{" "}
              <span className="mono">ANTHROPIC_API_KEY</span> to enable extraction.
            </p>
          )
        ) : (
          <p className="small muted">Ask an owner or admin to extract the design system.</p>
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
