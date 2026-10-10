import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { features } from "@/lib/env";
import { listCompanyRepos } from "@/lib/repos";
import { decryptSecret } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export default async function SpaceSettingsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireUser();
  const repoFullName = decodeURIComponent(params.slug);
  const manage = can.manageCompany(user.role);
  const company = await db.company.findUnique({ where: { id: user.companyId } });

  const repos = await listCompanyRepos(user.companyId);
  const repo = repos.find((r) => r.fullName === repoFullName);

  const hasGithub = Boolean(company?.githubConnected);
  const hasAnthropicKey = Boolean(features.anthropic);

  let maskedKey = "";
  if (company?.githubAccessToken) {
    const token = decryptSecret(company.githubAccessToken);
    if (token) maskedKey = token.slice(0, 8) + "••••••••••••" + token.slice(-4);
  }

  return (
    <>
      <div className="main-header">
        <div>
          <h1>Space Settings — {repo?.fullName.split("/").pop() ?? repoFullName}</h1>
          <p>Configure connections and documents for this workspace</p>
        </div>
        <div className="header-actions">
          <a
            href={`/spaces/${params.slug}`}
            className="btn btn-primary btn-sm"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Manage Space
          </a>
        </div>
      </div>
      <div className="content">
        {/* Connections */}
        <div className="section-heading">Connections</div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="conn-list">
            {/* GitHub */}
            <div className="conn-item">
              <div className="conn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </div>
              <div className="conn-info">
                <div className="conn-name">GitHub Repository</div>
                <div className="conn-desc">
                  {hasGithub && repo ? (
                    <>Connected to <strong>{repo.fullName}</strong> · main branch</>
                  ) : (
                    "Not connected"
                  )}
                </div>
              </div>
              <div className="conn-status">
                {hasGithub && repo ? (
                  <>
                    <span className="badge badge-connected"><span className="badge-dot" />Connected</span>
                    <a
                      href={`https://github.com/${repo.fullName}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}
                    >
                      ↗ Open
                    </a>
                  </>
                ) : (
                  <>
                    <span className="badge badge-disconnected">Disconnected</span>
                    {manage && (
                      <a href="/api/oauth/github/start" className="btn btn-primary btn-sm">Connect</a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Anthropic */}
            <div className="conn-item">
              <div className="conn-icon">🤖</div>
              <div className="conn-info">
                <div className="conn-name">Anthropic API Key</div>
                <div className="conn-desc">
                  {hasAnthropicKey ? "Configured via environment variable" : "Not configured"}
                </div>
              </div>
              <div className="conn-status">
                {hasAnthropicKey ? (
                  <span className="badge badge-connected"><span className="badge-dot" />Active</span>
                ) : (
                  <span className="badge badge-disconnected">Not set</span>
                )}
              </div>
            </div>

            {/* Jira */}
            <div className="conn-item">
              <div className="conn-icon">📋</div>
              <div className="conn-info">
                <div className="conn-name">Jira</div>
                <div className="conn-desc">Link your Jira project for ticket automation</div>
              </div>
              <div className="conn-status">
                <span className="badge badge-disconnected">Disconnected</span>
                {manage && (
                  <a href="/integrations/jira" className="btn btn-primary btn-sm">Connect</a>
                )}
              </div>
            </div>

            {/* App URLs */}
            <div className="conn-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                <div className="conn-icon">🌐</div>
                <div className="conn-info">
                  <div className="conn-name">Application URLs</div>
                  <div className="conn-desc">Live and testing environments</div>
                </div>
              </div>
              <div style={{ paddingLeft: 50, width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12, fontWeight: 500, minWidth: 70, color: "var(--fg2)" }}>Live App</label>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    defaultValue={company?.appBaseUrl ?? ""}
                    placeholder="https://..."
                    readOnly={!manage}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 12, fontWeight: 500, minWidth: 70, color: "var(--fg2)" }}>Preview</label>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    defaultValue={company?.previewUrlTemplate ?? ""}
                    placeholder="https://app-{branch}.up.railway.app"
                    readOnly={!manage}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Context Documents */}
        <div className="section-heading">Context Documents</div>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <DocumentCard title="Company Context" hint="PDF, DOCX, TXT up to 20MB" />
          <DocumentCard title="App Documentation" hint="Technical specs, API docs, ERDs" />
          <DocumentCard title="Language & Tone Guide" hint="Brand voice, terminology, style guide" />
          <DocumentCard title="Process Documents" hint="SOPs, workflows, org charts" />
        </div>
      </div>
    </>
  );
}

function DocumentCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="card">
      <div className="card-header"><h2>{title}</h2></div>
      <div className="card-body">
        <div className="upload-zone">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p>Drop file or click to upload</p>
          <span>{hint}</span>
        </div>
      </div>
    </div>
  );
}
