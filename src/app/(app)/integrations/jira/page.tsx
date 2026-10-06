import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { connectJira, disconnectJira } from "@/app/actions/jira";

export default async function JiraConnectPage() {
  const user = await requireUser();
  const existing = await db.jiraConnection.findUnique({
    where: { companyId: user.companyId },
    select: { baseUrl: true, email: true, updatedAt: true },
  });

  return (
    <div className="container narrow">
      <div className="page-header">
        <h1>Connect Jira</h1>
        <p className="muted">
          Paste your Atlassian site URL, the email on the account, and an API
          token from <Link href="https://id.atlassian.com/manage-profile/security/api-tokens">your Atlassian profile</Link>.
          Token is encrypted at rest.
        </p>
      </div>

      {existing && (
        <div className="card">
          <p>
            Connected to <span className="mono">{existing.baseUrl}</span> as{" "}
            <span className="mono">{existing.email}</span>.
          </p>
          <form action={disconnectJira}>
            <button type="submit" className="btn danger small">Disconnect</button>
          </form>
        </div>
      )}

      <form action={connectJira} className="card stack">
        <label>
          Site URL
          <input name="baseUrl" placeholder="https://acme.atlassian.net" required defaultValue={existing?.baseUrl} />
        </label>
        <label>
          Account email
          <input name="email" type="email" required defaultValue={existing?.email} />
        </label>
        <label>
          API token
          <input name="apiToken" type="password" required />
        </label>
        <button type="submit" className="btn primary">
          Verify and save
        </button>
      </form>
    </div>
  );
}
