"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { registerCompany, type ActionState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Creating…" : "Create company"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, action] = useFormState<ActionState, FormData>(registerCompany, undefined);

  return (
    <div className="container" style={{ maxWidth: 460 }}>
      <div className="hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 28 }}>Create your company</h1>
        <p className="small">
          You'll be the owner. Invite collaborators and stakeholders once you're in.
        </p>
      </div>
      <div className="card">
        <form action={action}>
          <label htmlFor="companyName">Company name</label>
          <input id="companyName" name="companyName" placeholder="Acme Inc." required />

          <label htmlFor="name">Your name</label>
          <input id="name" name="name" placeholder="Ada Lovelace" required />

          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" placeholder="ada@acme.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" placeholder="At least 8 characters" required />

          {state?.error && <div className="error">{state.error}</div>}
          <SubmitButton />
        </form>
      </div>
      <p className="small muted">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
