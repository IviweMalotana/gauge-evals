import { requireUser } from "@/lib/guards";
import Link from "next/link";

export default async function NewSpacePage() {
  await requireUser();

  return (
    <>
      <div className="main-header">
        <div>
          <h1>New Space</h1>
          <p>Connect a repository to create a new workspace</p>
        </div>
      </div>
      <div className="content" style={{ maxWidth: 560 }}>
        <div className="card">
          <div className="card-header"><h2>Connect Repository</h2></div>
          <div className="card-body">
            <p style={{ color: "var(--fg2)", marginBottom: 16 }}>
              To create a new space, first connect a GitHub repository from the
              settings page.
            </p>
            <Link href="/settings" className="btn btn-primary">
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
