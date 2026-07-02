import type { ReactNode } from "react";
import { requireUser } from "@/lib/guards";
import { TopBar } from "@/components/TopBar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div>
      <TopBar companyName={user.companyName} role={user.role} />
      <div className="container">{children}</div>
    </div>
  );
}
