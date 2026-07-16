import Link from "next/link";
import { isActive, needsAttention, statusLabel } from "@/lib/pipeline-view";
import { setActiveRepo } from "@/app/actions/workspace";

export interface SidebarRequest {
  id: string;
  title: string;
  status: string;
}

/**
 * Left workspace rail: the connected repositories as a list. The active repo is
 * expanded to show its sessions (requests) + a "New request" for that repo;
 * other repos collapse to a clickable row (name + session count) that switches
 * to them. "Connect repository" adds more.
 */
export function AppSidebar({
  repos,
  activeRepo,
  requestsByRepo,
}: {
  repos: string[];
  activeRepo: string | null;
  requestsByRepo: Record<string, SidebarRequest[]>;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-heading small muted">Repositories</div>
      </div>

      <div className="sidebar-list">
        {repos.length === 0 ? (
          <div style={{ padding: "0 12px" }}>
            <p className="small muted">No repositories connected.</p>
            <Link href="/settings" className="btn secondary small" style={{ width: "100%" }}>
              Connect a repository
            </Link>
          </div>
        ) : (
          repos.map((repo) => {
            const sessions = requestsByRepo[repo] ?? [];
            const open = repo === activeRepo;
            return (
              <div key={repo} className={`repo-group ${open ? "open" : ""}`}>
                {open ? (
                  <div className="repo-head active">
                    <span className="repo-name mono">{repo}</span>
                    <span className="repo-count">{sessions.length}</span>
                  </div>
                ) : (
                  <form action={setActiveRepo}>
                    <input type="hidden" name="repo" value={repo} />
                    <button type="submit" className="repo-head" title={`Switch to ${repo}`}>
                      <span className="repo-name mono">{repo}</span>
                      <span className="repo-count">{sessions.length}</span>
                    </button>
                  </form>
                )}

                {open && (
                  <div className="repo-body">
                    <Link href="/requests/new" className="new-session">
                      + New request
                    </Link>
                    {sessions.length === 0 ? (
                      <p className="small muted" style={{ padding: "4px 12px" }}>
                        No sessions in this repo yet.
                      </p>
                    ) : (
                      <ul className="sidebar-requests">
                        {sessions.map((r) => (
                          <li key={r.id}>
                            <Link
                              href={`/requests/${r.id}`}
                              className="sidebar-request"
                              title={statusLabel(r.status)}
                            >
                              <span
                                className={`sr-dot ${
                                  isActive(r.status)
                                    ? "sr-active"
                                    : needsAttention(r.status)
                                      ? "sr-attn"
                                      : r.status === "DONE"
                                        ? "sr-done"
                                        : "sr-idle"
                                }`}
                                aria-hidden
                              />
                              <span className="sr-title">{r.title}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {repos.length > 0 && (
          <Link href="/settings" className="add-repo small">
            + Connect repository
          </Link>
        )}
      </div>
    </aside>
  );
}
