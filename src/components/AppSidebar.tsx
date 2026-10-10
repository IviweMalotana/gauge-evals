import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export interface SidebarSpace {
  name: string;
  initials: string;
  color: string;
  slug: string;
  fullName: string;
}

export interface SidebarUser {
  name: string | null;
  email: string;
  initials: string;
}

export function AppSidebar({
  spaces,
  activeSpace,
  user,
  currentPath,
}: {
  spaces: SidebarSpace[];
  activeSpace: string | null;
  user: SidebarUser;
  currentPath: string;
}) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 3" />
        </svg>
        <span>{APP_NAME}</span>
      </div>

      {/* Account section */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Account</div>
        <Link
          href="/settings/profile"
          className={`sidebar-item${currentPath === "/settings/profile" ? " active" : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          Profile
        </Link>
        <Link
          href="/settings/billing"
          className={`sidebar-item${currentPath === "/settings/billing" ? " active" : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
          Billing &amp; Plan
        </Link>
        <Link
          href="/settings/security"
          className={`sidebar-item${currentPath === "/settings/security" ? " active" : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Security
        </Link>
      </div>

      {/* Spaces section */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Spaces</div>
        {spaces.map((space) => {
          const isOpen = space.slug === activeSpace;
          return (
            <SpaceItem
              key={space.slug}
              space={space}
              isOpen={isOpen}
              currentPath={currentPath}
            />
          );
        })}
      </div>

      <Link href="/spaces/new" className="add-space-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New Space
      </Link>

      {/* User footer */}
      <Link href="/settings/profile" className="sidebar-user">
        <div className="user-avatar">{user.initials}</div>
        <div className="user-info">
          <div className="user-name">{user.name ?? "User"}</div>
          <div className="user-email">{user.email}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--fg3)" }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </aside>
  );
}

function SpaceItem({
  space,
  isOpen,
  currentPath,
}: {
  space: SidebarSpace;
  isOpen: boolean;
  currentPath: string;
}) {
  const settingsPath = `/spaces/${space.slug}/settings`;
  const managePath = `/spaces/${space.slug}`;

  return (
    <div className="space-item">
      <Link
        href={managePath}
        className={`space-header${isOpen ? " active-space" : ""}`}
      >
        <div className="space-avatar" style={{ background: space.color }}>
          {space.initials}
        </div>
        <span className="space-name">{space.name}</span>
        <svg
          className={`space-chevron${isOpen ? " open" : ""}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>

      {isOpen && (
        <div className="space-sub open">
          <Link
            href={settingsPath}
            className={`space-sub-item${currentPath === settingsPath ? " active" : ""}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Link>
          <Link
            href={managePath}
            className={`space-sub-item${currentPath === managePath ? " active" : ""}`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Manage Space
          </Link>
        </div>
      )}
    </div>
  );
}
