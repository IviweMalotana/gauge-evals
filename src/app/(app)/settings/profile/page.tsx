import { requireUser } from "@/lib/guards";
import { ROLES, type Role } from "@/lib/domain";
import { updateProfile } from "@/app/actions/profile";

function roleLabel(r: Role): string {
  switch (r) {
    case "OWNER": return "Owner";
    case "ADMIN": return "Admin";
    case "BA": return "Business Analyst";
    case "PRODUCT": return "Product Manager";
    case "DEVELOPER": return "Developer";
    case "QA": return "QA";
    case "VIEWER": return "Viewer";
    case "COLLABORATOR": return "Collaborator";
    case "STAKEHOLDER": return "Stakeholder";
    default: return r;
  }
}

export default async function ProfilePage() {
  const user = await requireUser();
  const nameParts = (user.name ?? "").split(" ");
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  return (
    <>
      <div className="main-header">
        <div>
          <h1>Profile</h1>
          <p>Manage your personal information</p>
        </div>
      </div>
      <div className="content">
        <div style={{ maxWidth: 700 }}>
          <div className="card">
            <div className="card-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <h2>Personal Details</h2>
            </div>
            <div className="card-body">
              <form action={updateProfile}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="firstName">First Name</label>
                    <input className="form-input" id="firstName" name="firstName" defaultValue={firstName} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="lastName">Last Name</label>
                    <input className="form-input" id="lastName" name="lastName" defaultValue={lastName} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input className="form-input" id="email" name="email" type="email" defaultValue={user.email} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" disabled defaultValue={user.role}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabel(r)}</option>
                    ))}
                  </select>
                  <div className="form-hint">Role is managed by your organization admin</div>
                </div>
                <button className="btn btn-primary" type="submit">Save Changes</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
