import Link from "next/link";
import { isActive, needsAttention, statusLabel } from "@/lib/pipeline-view";
import { RepoSwitcher } from "@/components/RepoSwitcher";

export interface SidebarRequest {
  id: string;
  title: string;
  status: string;
}

/**
 * Left workspace rail (like an editor's session list): a repo switcher at the
 * top, a "New request" button, and the requests for the active repo — newest
 * first, each linking to its detail page with a live status dot.
 */
export function AppSidebar({
  repos,
  activeRepo,
  requests,
}: {
  repos: string[];
  activeRepo: string | null;
  requests: SidebarRequest[];
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <RepoSwitcher repos={repos} active={activeRepo} />
        <Link href="/requests/new" className="btn small" style={{ width: "100%", marginTop: 8 }}>
          + New request
        </Link>
      </div>

      <div className="sidebar-list">
        <div className="sidebar-heading small muted">
          Requests{activeRepo ? "" : " (all repos)"}
        </div>
        {requests.length === 0 ? (
          <p className="small muted" style={{ padding: "0 12px" }}>
            No requests{activeRepo ? " for this repo" : ""} yet.
          </p>
        ) : (
          <ul className="sidebar-requests">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="sidebar-request" title={statusLabel(r.status)}>
                  <span
                    className={`sr-dot ${isActive(r.status) ? "sr-active" : needsAttention(r.status) ? "sr-attn" : r.status === "DONE" ? "sr-done" : "sr-idle"}`}
                    aria-hidden
                  />
                  <span className="sr-title">{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
