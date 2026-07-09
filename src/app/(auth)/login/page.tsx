"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login, type ActionState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16 }}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState<ActionState, FormData>(login, undefined);

  return (
    <div className="container" style={{ maxWidth: 460 }}>
      <div className="hero" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: 28 }}>Sign in</h1>
        <p className="small">Welcome back.</p>
      </div>
      <div className="card">
        <p className="muted" style={{ marginTop: 0, marginBottom: 20, fontSize: 15 }}>
          Welcome back
        </p>
        <form action={action}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" placeholder="ada@acme.com" required />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />

          {state?.error && <div className="error">{state.error}</div>}
          <SubmitButton />
        </form>
      </div>
      <p className="small muted">
        New here? <Link href="/register">Create a company</Link>
      </p>
    </div>
  );
}
