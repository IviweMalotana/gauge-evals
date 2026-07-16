import type { ReactNode } from "react";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import type { GithubStatusInfo } from "@/components/GithubStatus";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const company = await db.company.findUnique({
    where: { id: user.companyId },
    select: {
      githubConnected: true,
      githubLogin: true,
      githubAvatarUrl: true,
      githubDefaultRepo: true,
      _count: { select: { repos: true } },
    },
  });
  const github: GithubStatusInfo = {
    connected: Boolean(company?.githubConnected),
    login: company?.githubLogin ?? null,
    avatarUrl: company?.githubAvatarUrl ?? null,
    defaultRepo: company?.githubDefaultRepo ?? null,
    repoCount: company?._count.repos ?? 0,
  };
  return (
    <div>
      <TopBar companyName={user.companyName} role={user.role} github={github} />
      <div className="container">{children}</div>
    </div>
  );
}
