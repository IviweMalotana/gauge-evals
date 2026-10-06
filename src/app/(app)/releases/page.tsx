import { requireUser } from "@/lib/guards";
import { db } from "@/lib/db";

export default async function ReleasesPage() {
  const user = await requireUser();
  const releases = await db.release.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "desc" },
    include: { notes: true, project: { select: { name: true } } },
    take: 50,
  });

  return (
    <div className="container">
      <div className="page-header">
        <h1>Releases</h1>
        <p className="muted">
          Internal, technical, and user-facing notes for every release the
          pipeline cuts.
        </p>
      </div>

      {releases.length === 0 ? (
        <div className="card">
          <p>No releases yet. A release is created when a batch of DONE tickets ships.</p>
        </div>
      ) : (
        <div className="stack">
          {releases.map((r) => {
            const userNote = r.notes.find((n) => n.audience === "user");
            const techNote = r.notes.find((n) => n.audience === "technical");
            return (
              <article key={r.id} className="card">
                <header className="row between">
                  <h2 className="mono">{r.version}</h2>
                  <span className="small muted">
                    {r.publishedAt
                      ? `published ${new Date(r.publishedAt).toLocaleDateString()}`
                      : "draft"}
                  </span>
                </header>
                {r.project && <p className="small muted">{r.project.name}</p>}
                {userNote && (
                  <section>
                    <h3 className="small">What&apos;s new</h3>
                    <pre className="pre-wrap">{userNote.body}</pre>
                  </section>
                )}
                {techNote && (
                  <details>
                    <summary className="small">Technical changelog</summary>
                    <pre className="pre-wrap">{techNote.body}</pre>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
