import { requireUser } from "@/lib/guards";
import Link from "next/link";
import { ManageSpaceTabs } from "@/components/ManageSpaceTabs";

export default async function ManageSpacePage({
  params,
}: {
  params: { slug: string };
}) {
  await requireUser();
  const repoFullName = decodeURIComponent(params.slug);
  const shortName = repoFullName.split("/").pop() ?? repoFullName;

  return (
    <>
      <div className="main-header">
        <div>
          <h1>Manage Space — {shortName}</h1>
          <p>Generate artifacts, scan, plan tickets and more</p>
        </div>
        <div className="header-actions">
          <Link href={`/spaces/${params.slug}/settings`} className="btn btn-secondary btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Link>
        </div>
      </div>
      <div className="content">
        <ManageSpaceTabs
          tabs={[
            { id: "uml", label: "UML Diagrams", content: <UmlTab /> },
            { id: "scan", label: "Repo Scan", content: <ScanTab repo={repoFullName} /> },
            { id: "brd", label: "BRD Generator", content: <BrdTab /> },
            { id: "bugs", label: "Bug Scanner", content: <BugScannerTab /> },
            { id: "tickets", label: "Tickets & Issues", content: <TicketsTab /> },
            { id: "clone", label: "Site Clone", content: <SiteCloneTab /> },
            { id: "releases", label: "Release Notes", content: <ReleaseNotesTab /> },
            { id: "kb", label: "FAQ / KB", content: <KbTab /> },
          ]}
        />
      </div>
    </>
  );
}

function UmlTab() {
  return (
    <div>
      <div className="status-strip info" style={{ marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        UML generation follows best practices: C4 model, PlantUML syntax, auto-grouped by domain
      </div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="6" height="6" /><rect x="16" y="3" width="6" height="6" /><rect x="9" y="15" width="6" height="6" /><path d="M5 9v3h14V9M12 12v3" /></svg>}
          title="System Architecture"
          description="High-level C4 container and component diagrams showing services, databases, and external dependencies."
        />
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>}
          title="Sequence Diagrams"
          description="User flow and inter-service message sequences for all major application workflows."
        />
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>}
          title="Entity Relationship"
          description="Database schema ERD from Prisma models, with relationships, cardinality, and indexes."
        />
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M4 12a8 8 0 0 1 8-8v0a8 8 0 0 1 8 8v0a8 8 0 0 1-8 8v0a8 8 0 0 1-8-8z" /></svg>}
          title="State Machines"
          description="Business object lifecycle diagrams: order states, user onboarding, approval workflows."
        />
      </div>
      <button className="btn btn-primary">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
        Generate All
      </button>
    </div>
  );
}

function ScanTab({ repo }: { repo: string }) {
  return (
    <div className="card">
      <div className="card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
        <h2>GitHub Repo Scan</h2>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>Initiate Scan</button>
      </div>
      <div className="card-body">
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "var(--fg2)", marginBottom: 4 }}>Repository</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{repo}</div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "var(--fg2)", marginBottom: 4 }}>Last Scanned</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Never</div>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "var(--fg2)", marginBottom: 4 }}>Files Indexed</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>—</div>
          </div>
        </div>
        <div className="log-box">
          <div className="log-line-info">i Ready to scan. Click &quot;Initiate Scan&quot; to begin.</div>
        </div>
      </div>
    </div>
  );
}

function BrdTab() {
  return (
    <div>
      <div className="status-strip info" style={{ marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        AI uses uploaded company docs + GitHub scan context to generate thorough BA artifacts
      </div>
      <div className="section-heading">Select Artifacts to Generate</div>
      <div className="checklist" style={{ marginBottom: 20 }}>
        <CheckItem id="brd1" label="Feature BRDs" desc="Business requirements per feature with objectives, scope, stakeholder impact" defaultChecked />
        <CheckItem id="brd2" label="User Stories & Personas" desc="Role-based stories with acceptance criteria in Gherkin/BDD format" defaultChecked />
        <CheckItem id="brd3" label="Process Flow Diagrams" desc="BPMN-style workflow maps for each business process" />
        <CheckItem id="brd4" label="Use Case Documents" desc="Actor-goal tables with pre/post conditions and alternate flows" />
        <CheckItem id="brd5" label="Non-Functional Requirements" desc="Performance, security, accessibility, compliance requirements" />
        <CheckItem id="brd6" label="Data Dictionary" desc="All entities, attributes, data types, validation rules" />
        <CheckItem id="brd7" label="Risk & Dependency Matrix" desc="Risks, mitigations, blockers, and inter-feature dependencies" />
        <CheckItem id="brd8" label="Change Impact Analysis" desc="How each feature change ripples through the system" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          Generate Selected
        </button>
        <button className="btn btn-secondary">View Existing BRDs</button>
      </div>
    </div>
  );
}

function BugScannerTab() {
  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h2>Bug Scanner</h2>
        </div>
        <div className="card-body">
          <div style={{ marginBottom: 14 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Scan Interval</div>
            <div className="interval-group">
              <span className="interval-chip">Manual</span>
              <span className="interval-chip selected">Every 6h</span>
              <span className="interval-chip">Every 12h</span>
              <span className="interval-chip">Daily</span>
              <span className="interval-chip">Weekly</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button className="btn btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Scan Now
            </button>
          </div>
          <div className="log-box" style={{ height: 120 }}>
            <div className="log-line-info">i Ready to scan. Configure your app URL in Space Settings first.</div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h2>Recent Issues Found</h2></div>
        <div className="card-body">
          <p style={{ color: "var(--fg2)", fontSize: "12.5px" }}>No issues found yet. Run a scan to detect bugs.</p>
        </div>
      </div>
    </div>
  );
}

function TicketsTab() {
  return (
    <div>
      <div className="status-strip info" style={{ marginBottom: 16 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        Generate Jira-ready tickets from your BRDs and requirements corpus
      </div>
      <div className="grid-2">
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
          title="From BRD"
          description="Convert business requirements into structured tickets with acceptance criteria."
        />
        <ActionCard
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
          title="From Bug Scan"
          description="Create bug tickets from scanner findings with reproduction steps."
        />
      </div>
    </div>
  );
}

function SiteCloneTab() {
  return (
    <div>
      <div className="card">
        <div className="card-header"><h2>Site Clone Analysis</h2></div>
        <div className="card-body">
          <p style={{ color: "var(--fg2)", marginBottom: 16 }}>
            Clone and analyze your live site to detect differences between the codebase and production.
          </p>
          <div className="form-group">
            <label className="form-label">Site URL</label>
            <input className="form-input" placeholder="https://your-app.com" style={{ maxWidth: 400 }} />
          </div>
          <button className="btn btn-primary">Start Clone Analysis</button>
        </div>
      </div>
    </div>
  );
}

function ReleaseNotesTab() {
  return (
    <div>
      <div className="card">
        <div className="card-header"><h2>Release Notes Generator</h2></div>
        <div className="card-body">
          <p style={{ color: "var(--fg2)", marginBottom: 16 }}>
            Generate release notes from merged PRs, commit messages, and closed tickets.
          </p>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">From Tag / Date</label>
              <input className="form-input" placeholder="v1.0.0 or 2026-01-01" />
            </div>
            <div className="form-group">
              <label className="form-label">To Tag / Date</label>
              <input className="form-input" placeholder="HEAD" defaultValue="HEAD" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Audience</label>
            <select className="form-select" style={{ maxWidth: 240 }}>
              <option>End Users</option>
              <option>Technical / Developers</option>
              <option>Internal Team</option>
            </select>
          </div>
          <button className="btn btn-primary">Generate Release Notes</button>
        </div>
      </div>
    </div>
  );
}

function KbTab() {
  return (
    <div>
      <div className="card">
        <div className="card-header"><h2>FAQ / Knowledge Base</h2></div>
        <div className="card-body">
          <p style={{ color: "var(--fg2)", marginBottom: 16 }}>
            Auto-generate FAQ and knowledge base articles from your codebase, documentation, and support history.
          </p>
          <div className="checklist" style={{ marginBottom: 20 }}>
            <CheckItem id="kb1" label="API Documentation" desc="Endpoint reference with examples" defaultChecked />
            <CheckItem id="kb2" label="User Guide" desc="Step-by-step instructions for common workflows" defaultChecked />
            <CheckItem id="kb3" label="Troubleshooting" desc="Common errors and their solutions" />
            <CheckItem id="kb4" label="Architecture Overview" desc="System design for technical onboarding" />
          </div>
          <button className="btn btn-primary">Generate Knowledge Base</button>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="action-card">
      <div className="action-card-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="action-card-footer">
        <button className="btn btn-primary btn-sm">Generate</button>
      </div>
    </div>
  );
}

function CheckItem({
  id,
  label,
  desc,
  defaultChecked,
}: {
  id: string;
  label: string;
  desc: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="check-item">
      <input type="checkbox" id={id} defaultChecked={defaultChecked} />
      <label htmlFor={id}>
        {label} <span className="check-desc">— {desc}</span>
      </label>
    </div>
  );
}
