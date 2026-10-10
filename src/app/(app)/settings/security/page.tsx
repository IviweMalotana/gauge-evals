import { requireUser } from "@/lib/guards";
import { updatePassword } from "@/app/actions/security";

export default async function SecurityPage() {
  await requireUser();

  return (
    <>
      <div className="main-header">
        <div>
          <h1>Security</h1>
          <p>Password and authentication settings</p>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 560 }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2>Change Password</h2>
          </div>
          <div className="card-body">
            <form action={updatePassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="currentPassword">Current Password</label>
                <input className="form-input" id="currentPassword" name="currentPassword" type="password" placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="newPassword">New Password</label>
                <input className="form-input" id="newPassword" name="newPassword" type="password" placeholder="••••••••" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirmPassword">Confirm New Password</label>
                <input className="form-input" id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" />
              </div>
              <button className="btn btn-primary" type="submit">Update Password</button>
            </form>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h2>Two-Factor Authentication</h2></div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: "13.5px" }}>Authenticator App</div>
                <div style={{ fontSize: 12, color: "var(--fg2)", marginTop: 2 }}>Add an extra layer of security</div>
              </div>
              <span className="badge badge-disconnected">Not enabled</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
