import Link from "next/link";
import { logout } from "@/app/actions/auth";

export function TopBar({
  companyName,
  role,
}: {
  companyName: string;
  role: string;
}) {
  return (
    <div className="topbar">
      <div className="row">
        <Link href="/dashboard" className="brand">
          ⟡ Gauge
        </Link>
        <span className="muted small" style={{ marginLeft: 12 }}>
          {companyName} · <span className="badge role">{role}</span>
        </span>
      </div>
      <nav className="row">
        <Link href="/requests">Requests</Link>
        <Link href="/members">Members</Link>
        <Link href="/settings">Settings</Link>
        <form action={logout} style={{ display: "inline", marginLeft: 18 }}>
          <button className="btn secondary small" type="submit">
            Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
