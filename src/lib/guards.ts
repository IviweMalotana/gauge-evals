import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./auth";

/**
 * For use at the top of protected server components / server actions. Redirects
 * to /login when there's no authenticated user with a company.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
