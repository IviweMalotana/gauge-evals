import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";

/**
 * Portfolio / Projects — the top-level dashboard the spec (§9) describes.
 * Lists every Project under the company with the Jira project it tracks, the
 * repo it tracks, and whether a Product Baseline has been built.
 */
export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { companyId: user.companyId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          requests: true,
          modules: true,
          screens: true,
          entities: true,
          releases: true,
        },
      },
    },
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1>Projects</h1>
        <p className="muted">
          One project = one Jira project + one repository + the baseline we
          keep for it. Create a project once you&apos;ve connected both.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p>No projects yet.</p>
          <p className="small muted">
            Connect GitHub and Jira under <Link href="/integrations">Integrations</Link>, then
            create a project to run the baseline.
          </p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Repo</th>
              <th>Jira</th>
              <th>Baseline</th>
              <th className="right">Tickets</th>
              <th className="right">Modules</th>
              <th className="right">Screens</th>
              <th className="right">Entities</th>
              <th className="right">Releases</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/projects/${p.slug}`}>{p.name}</Link></td>
                <td className="mono small">{p.repoFullName ?? "—"}</td>
                <td className="mono small">{p.jiraProjectKey ?? "—"}</td>
                <td className="small">
                  {p.baselineAt
                    ? new Date(p.baselineAt).toLocaleString()
                    : "not built"}
                </td>
                <td className="right">{p._count.requests}</td>
                <td className="right">{p._count.modules}</td>
                <td className="right">{p._count.screens}</td>
                <td className="right">{p._count.entities}</td>
                <td className="right">{p._count.releases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
