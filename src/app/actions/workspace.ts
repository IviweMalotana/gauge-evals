"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import { listCompanyRepos } from "@/lib/repos";
import { ACTIVE_REPO_COOKIE } from "@/lib/workspace";

/**
 * Switch the workspace's active repository. Stored in a cookie so the sidebar
 * filter and the new-request default persist across pages (like picking a
 * project). Only accepts a repo actually connected to the company.
 */
export async function setActiveRepo(formData: FormData): Promise<void> {
  const user = await requireUser();
  const repo = String(formData.get("repo") ?? "").trim();
  const repos = await listCompanyRepos(user.companyId);
  if (repo && repos.some((r) => r.fullName === repo)) {
    cookies().set(ACTIVE_REPO_COOKIE, repo, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  revalidatePath("/", "layout");
}
