import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { AppSidebar } from "@/components/AppSidebar";
import type { GithubStatusInfo } from "@/components/GithubStatus";
import {
  ensureReposBackfilled,
  listCompanyRepos,
  requestMatchesRepo,
  resolveActiveRepo,
} from "@/lib/repos";
import { ACTIVE_REPO_COOKIE } from "@/lib/workspace";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: {
      githubConnected: true,
      githubLogin: true,
      githubAvatarUrl: true,
      githubDefaultRepo: true,
    },
  });
  if (company?.githubConnected) {
    await ensureReposBackfilled({ id: user.companyId, githubDefaultRepo: company.githubDefaultRepo });
  }

  const repos = await listCompanyRepos(user.companyId);
  const repoNames = repos.map((r) => r.fullName);
  const cookieRepo = cookies().get(ACTIVE_REPO_COOKIE)?.value ?? null;
  const activeRepo = resolveActiveRepo(cookieRepo, repoNames, company?.githubDefaultRepo);

  const allRequests = await db.request.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, repoFullName: true },
    take: 100,
  });
  const sidebarRequests = allRequests.filter((r) =>
    requestMatchesRepo(r.repoFullName, activeRepo, company?.githubDefaultRepo)
  );

  const github: GithubStatusInfo = {
    connected: Boolean(company?.githubConnected),
    login: company?.githubLogin ?? null,
    avatarUrl: company?.githubAvatarUrl ?? null,
    defaultRepo: activeRepo ?? company?.githubDefaultRepo ?? null,
    repoCount: repos.length,
  };

  return (
    <div>
      <TopBar companyName={user.companyName} role={user.role} github={github} />
      <div className="shell">
        <AppSidebar repos={repoNames} activeRepo={activeRepo} requests={sidebarRequests} />
        <div className="container main">{children}</div>
      </div>
    </div>
  );
}
