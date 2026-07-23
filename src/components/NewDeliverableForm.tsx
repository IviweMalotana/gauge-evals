"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createDeliverable,
  type DeliverableActionState,
} from "@/app/actions/deliverables";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Generating…" : "Generate deliverable"}
    </button>
  );
}

export interface DeliverableKindOption {
  kind: string;
  label: string;
  methodology: string;
  description: string;
}

export function NewDeliverableForm({
  kinds,
  requests,
}: {
  kinds: DeliverableKindOption[];
  requests: { id: string; title: string }[];
}) {
  const [state, action] = useFormState<DeliverableActionState, FormData>(
    createDeliverable,
    undefined
  );

  return (
    <form action={action}>
      <label htmlFor="kind">Deliverable</label>
      <select id="kind" name="kind" defaultValue={kinds[0]?.kind}>
        {kinds.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.label} · {k.methodology} — {k.description}
          </option>
        ))}
      </select>

      <label htmlFor="requestId">Scope</label>
      <select id="requestId" name="requestId" defaultValue="">
        <option value="">Whole workspace</option>
        {requests.map((r) => (
          <option key={r.id} value={r.id}>
            Request: {r.title}
          </option>
        ))}
      </select>

      {state?.error && <div className="error">{state.error}</div>}
      <SubmitButton />
    </form>
  );
}
