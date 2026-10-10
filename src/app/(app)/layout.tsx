import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";
import { AppSidebar, type SidebarSpace } from "@/components/AppSidebar";
import { ensureReposBackfilled, listCompanyRepos, resolveActiveRepo } from "@/lib/repos";
import { ACTIVE_REPO_COOKIE } from "@/lib/workspace";

const SPACE_COLORS = [
  "#6d28d9", "#0891b2", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#2563eb", "#db2777",
];

function initials(name: string): string {
  return name
    .split(/[\s\/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

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

  const spaces: SidebarSpace[] = repoNames.map((name, i) => ({
    name: name.split("/").pop() ?? name,
    initials: initials(name),
    color: SPACE_COLORS[i % SPACE_COLORS.length],
    slug: encodeURIComponent(name),
    fullName: name,
  }));

  const activeSpace = activeRepo ? encodeURIComponent(activeRepo) : null;

  const headersList = headers();
  const pathname = headersList.get("x-next-pathname") ?? "/dashboard";

  const userInitials = user.name
    ? initials(user.name)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <AppSidebar
        spaces={spaces}
        activeSpace={activeSpace}
        user={{ name: user.name, email: user.email, initials: userInitials }}
        currentPath={pathname}
      />
      <main className="main">{children}</main>
    </div>
  );
}
