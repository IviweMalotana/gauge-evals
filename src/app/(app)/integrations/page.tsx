import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { AGENT_ROLES } from "@/lib/domain";

/**
 * Integrations hub — one page the user visits to confirm every external
 * dependency is wired: GitHub, Jira, AI provider, Playwright. Each row shows
 * current state and links out to the setup flow.
 */
export default async function IntegrationsPage() {
  const user = await requireUser();
  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: {
      githubConnected: true,
      githubLogin: true,
      githubDefaultRepo: true,
      appBaseUrl: true,
      previewUrlTemplate: true,
      modelRouting: true,
      jira: {
        select: { baseUrl: true, email: true, cloudId: true, updatedAt: true },
      },
    },
  });

  const routing = parseRouting(company?.modelRouting ?? null);

  return (
    <div className="container">
      <div className="page-header">
        <h1>Integrations</h1>
        <p className="muted">
          GitHub, Jira, your AI provider, and Playwright. Keep each one green
          — the pipeline fails forward (template BRD, review-only QA) when
          one is down, but you lose the real behaviour.
        </p>
      </div>

      <section className="card">
        <div className="row between">
          <h2>GitHub</h2>
          <Link href="/settings" className="btn secondary small">Manage</Link>
        </div>
        {company?.githubConnected ? (
          <ul className="small">
            <li>Account: <span className="mono">{company.githubLogin}</span></li>
            <li>Default repo: <span className="mono">{company.githubDefaultRepo ?? "—"}</span></li>
          </ul>
        ) : (
          <p className="muted small">Not connected. Head to Settings to start OAuth.</p>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h2>Jira</h2>
          <Link href="/integrations/jira" className="btn secondary small">
            {company?.jira ? "Reconnect" : "Connect"}
          </Link>
        </div>
        {company?.jira ? (
          <ul className="small">
            <li>Site: <span className="mono">{company.jira.baseUrl}</span></li>
            <li>Account: <span className="mono">{company.jira.email}</span></li>
            {company.jira.cloudId && <li>Cloud id: <span className="mono">{company.jira.cloudId}</span></li>}
          </ul>
        ) : (
          <p className="muted small">
            Not connected. Baton reads Jira projects, epics and tickets — and
            links each Baton request to its Jira issue — once you add a site
            URL + API token.
          </p>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <h2>AI model routing</h2>
          <Link href="/settings" className="btn secondary small">Change provider</Link>
        </div>
        <p className="small muted">
          Each agent can run on a different provider:model, so classification
          and extraction stay cheap while senior-BA reasoning uses the stronger
          tier.
        </p>
        <table className="table">
          <thead><tr><th>Agent</th><th>Provider : model</th></tr></thead>
          <tbody>
            {AGENT_ROLES.map((role) => (
              <tr key={role}>
                <td className="mono small">{role}</td>
                <td className="mono small">{routing[role] ?? "default (anthropic)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="row between">
          <h2>Playwright</h2>
          <Link href="/settings" className="btn secondary small">Manage</Link>
        </div>
        <ul className="small">
          <li>App base URL: <span className="mono">{company?.appBaseUrl ?? "—"}</span></li>
          <li>Preview template: <span className="mono">{company?.previewUrlTemplate ?? "—"}</span></li>
        </ul>
      </section>
    </div>
  );
}

function parseRouting(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
