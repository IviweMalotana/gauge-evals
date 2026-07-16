"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createRequest, type ReqActionState } from "@/app/actions/requests";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Filing…" : "File request"}
    </button>
  );
}

export function NewRequestForm({
  repos,
  defaultRepo,
}: {
  repos: string[];
  defaultRepo: string | null;
}) {
  const [state, action] = useFormState<ReqActionState, FormData>(createRequest, undefined);

  return (
    <form action={action}>
      <label htmlFor="title">Title</label>
      <input id="title" name="title" placeholder="Checkout button does nothing on mobile" required />

      <label htmlFor="description">Description</label>
      <textarea
        id="description"
        name="description"
        placeholder="What did you expect? What happened instead? Steps to see it, if it's a bug."
        required
      />

      {repos.length > 0 && (
        <>
          <label htmlFor="repoFullName">Repository</label>
          <select id="repoFullName" name="repoFullName" defaultValue={defaultRepo ?? repos[0]}>
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
                {r === defaultRepo ? " (default)" : ""}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="priority">Priority</label>
      <select id="priority" name="priority" defaultValue="normal">
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
      </select>

      {state?.error && <div className="error">{state.error}</div>}
      <SubmitButton />
    </form>
  );
}
