import { db } from "./db";
import { runAfterApproval, runToApproval } from "./agents/orchestrator";

/**
 * Minimal durable job queue with an in-process worker.
 *
 * Filing a request / approving a BRD enqueues a Job and returns immediately;
 * the worker drains the queue off the request path. Jobs are persisted, so a
 * restart resumes queued work (and re-queues anything that was mid-flight).
 *
 * This suits a single long-running instance (e.g. Railway). For multiple
 * instances you'd move to a real broker; the enqueue() call site wouldn't
 * change.
 */

export type JobKind = "to_approval" | "after_approval";

const g = globalThis as unknown as { gaugeWorkerStarted?: boolean };

export async function enqueue(kind: JobKind, requestId: string): Promise<void> {
  await db.job.create({ data: { kind, requestId, status: "queued" } });
  ensureWorker();
}

/** Start the worker loop once per process (idempotent). */
export function ensureWorker(): void {
  if (g.gaugeWorkerStarted) return;
  g.gaugeWorkerStarted = true;
  void bootstrapAndLoop();
}

async function bootstrapAndLoop(): Promise<void> {
  // Recover jobs that were "running" when the process last stopped.
  try {
    await db.job.updateMany({ where: { status: "running" }, data: { status: "queued" } });
  } catch {
    // DB may not be ready yet on cold boot; the loop will retry.
  }
  loop().catch(() => {
    // If the loop dies unexpectedly, allow a future enqueue to restart it.
    g.gaugeWorkerStarted = false;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loop(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const job = await claimNext().catch(() => null);
    if (!job) {
      await sleep(1500);
      continue;
    }
    try {
      if (job.kind === "to_approval") await runToApproval(job.requestId);
      else if (job.kind === "after_approval") await runAfterApproval(job.requestId);
      await db.job.update({ where: { id: job.id }, data: { status: "done" } });
    } catch (err) {
      await db.job.update({
        where: { id: job.id },
        data: { status: "error", error: String(err).slice(0, 500) },
      });
    }
  }
}

/** Atomically claim the oldest queued job (best-effort for one instance). */
async function claimNext() {
  const job = await db.job.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return null;
  const res = await db.job.updateMany({
    where: { id: job.id, status: "queued" },
    data: { status: "running", attempts: { increment: 1 } },
  });
  return res.count === 1 ? job : null; // lost the race to another tick
}
