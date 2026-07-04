"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addMember, type MemberActionState } from "@/app/actions/members";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add member"}
    </button>
  );
}

export function AddMemberForm() {
  const [state, action] = useFormState<MemberActionState, FormData>(
    addMember,
    undefined
  );

  return (
    <form action={action}>
      <div className="grid cols-2">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="teammate@acme.com" required />
        </div>
        <div>
          <label htmlFor="name">Name (optional)</label>
          <input id="name" name="name" placeholder="Grace Hopper" />
        </div>
      </div>
      <label htmlFor="role">Role</label>
      <select id="role" name="role" defaultValue="COLLABORATOR">
        <option value="ADMIN">Admin — manage members & settings</option>
        <option value="COLLABORATOR">Collaborator — file & run requests</option>
        <option value="STAKEHOLDER">Stakeholder — file & approve requests</option>
      </select>
      {state?.error && <div className="error">{state.error}</div>}
      {state?.ok && (
        <div className="notice" style={{ marginTop: 10 }}>
          {state.ok}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <SubmitButton />
      </div>
    </form>
  );
}
