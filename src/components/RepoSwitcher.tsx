"use client";

import { useRef } from "react";
import Link from "next/link";
import { setActiveRepo } from "@/app/actions/workspace";

/**
 * Workspace repo picker in the sidebar. Changing the selection submits the
 * server action, which sets the active-repo cookie and revalidates — so the
 * session list and new-request default follow the chosen repo.
 */
export function RepoSwitcher({ repos, active }: { repos: string[]; active: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);

  if (repos.length === 0) {
    return (
      <Link href="/settings" className="btn secondary small" style={{ width: "100%" }}>
        Connect a repository
      </Link>
    );
  }

  return (
    <form action={setActiveRepo} ref={formRef}>
      <label className="small muted" htmlFor="ws-repo">
        Repository
      </label>
      <select
        id="ws-repo"
        name="repo"
        className="repo-switch mono"
        defaultValue={active ?? repos[0]}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {repos.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </form>
  );
}
