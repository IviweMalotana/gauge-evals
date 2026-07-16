import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { ensureReposBackfilled, listCompanyRepos } from "@/lib/repos";
import { NewRequestForm } from "@/components/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const user = await requireUser();
  const company = await db.company.findUnique({ where: { id: user.companyId } });
  if (company?.githubConnected) {
    await ensureReposBackfilled({ id: company.id, githubDefaultRepo: company.githubDefaultRepo });
  }
  const repos = await listCompanyRepos(user.companyId);

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>New request</h2>
      <p className="muted small">
        Describe the problem or the capability you want. The UX-check agent will
        classify it (bug vs feature), then draft a BRD for you to approve.
      </p>
      <div className="card">
        <NewRequestForm
          repos={repos.map((r) => r.fullName)}
          defaultRepo={company?.githubDefaultRepo ?? null}
        />
      </div>
      <p className="small muted">
        Filing kicks off the pipeline in the background — you'll land on the
        request page and watch the UX check and BRD draft appear as they run.
        {repos.length === 0 && company?.githubConnected === false && (
          <> Connect GitHub and add a repository in Settings to target a repo.</>
        )}
      </p>
    </div>
  );
}
