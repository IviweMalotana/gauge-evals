import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { can } from "@/lib/auth";
import { AddMemberForm } from "@/components/AddMemberForm";
import { changeRole, removeMember } from "@/app/actions/members";
import { ROLES as ROLE_OPTIONS } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const user = await requireUser();
  const manage = can.manageMembers(user.role);

  const members = await db.membership.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return (
    <div>
      <h2>Members & roles</h2>

      {manage && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add a collaborator</h3>
          <AddMemberForm />
        </div>
      )}
      {!manage && (
        <div className="notice">
          Only owners and admins can manage members. You can view the team below.
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              {manage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.user.name ?? "—"}</td>
                <td className="small muted">{m.user.email}</td>
                <td>
                  {manage ? (
                    <form action={changeRole} className="row">
                      <input type="hidden" name="membershipId" value={m.id} />
                      <select name="role" defaultValue={m.role} style={{ width: 180 }}>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button className="btn secondary small" type="submit">
                        Save
                      </button>
                    </form>
                  ) : (
                    <span className="badge role">{m.role}</span>
                  )}
                </td>
                {manage && (
                  <td>
                    {m.user.id !== user.id && (
                      <form action={removeMember}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button className="btn danger small" type="submit">
                          Remove
                        </button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
