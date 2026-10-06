import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";

/**
 * Product baseline overview — the knowledge-model summary across the
 * company's projects. Each tile links into the per-project baseline where
 * modules, screens, routes, entities, APIs, business rules, and user
 * journeys live.
 */
export default async function ProductPage() {
  const user = await requireUser();
  const projects = await db.project.findMany({
    where: { companyId: user.companyId },
    include: {
      _count: {
        select: {
          modules: true,
          screens: true,
          routes: true,
          components: true,
          entities: true,
          apis: true,
          businessRules: true,
          journeys: true,
          decisions: true,
        },
      },
    },
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1>Product</h1>
        <p className="muted">
          The persistent understanding of your software. Observed from the
          repo, strongly inferred from code shape, or marked as needing human
          confirmation.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card">
          <p>Nothing to show yet — the baseline runs after a project is created.</p>
          <p className="small muted">
            Start under <Link href="/projects">Projects</Link>.
          </p>
        </div>
      ) : (
        <div className="grid">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.slug}`} className="card hover">
              <h3>{p.name}</h3>
              <p className="small muted">{p.repoFullName ?? "no repo"}</p>
              <dl className="kv">
                <div><dt>Modules</dt><dd>{p._count.modules}</dd></div>
                <div><dt>Screens</dt><dd>{p._count.screens}</dd></div>
                <div><dt>Routes</dt><dd>{p._count.routes}</dd></div>
                <div><dt>Components</dt><dd>{p._count.components}</dd></div>
                <div><dt>Entities</dt><dd>{p._count.entities}</dd></div>
                <div><dt>APIs</dt><dd>{p._count.apis}</dd></div>
                <div><dt>Rules</dt><dd>{p._count.businessRules}</dd></div>
                <div><dt>Journeys</dt><dd>{p._count.journeys}</dd></div>
                <div><dt>Decisions</dt><dd>{p._count.decisions}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
