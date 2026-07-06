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

export default function NewRequestPage() {
  const [state, action] = useFormState<ReqActionState, FormData>(
    createRequest,
    undefined
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>New request</h2>
      <p className="muted small">
        Describe the problem or the capability you want. The UX-check agent will
        classify it (bug vs feature), then draft a BRD for you to approve.
      </p>
      <div className="card">
        <form action={action}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            placeholder="Checkout button does nothing on mobile"
            required
          />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            placeholder="What did you expect? What happened instead? Steps to see it, if it's a bug."
            required
          />

          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>

          {state?.error && <div className="error">{state.error}</div>}
          <SubmitButton />
        </form>
      </div>
      <p className="small muted">
        Filing kicks off the pipeline in the background — you'll land on the
        request page and watch the UX check and BRD draft appear as they run.
      </p>
    </div>
  );
}
