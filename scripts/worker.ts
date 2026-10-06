/**
 * Standalone worker entrypoint.
 *
 * The Next.js app on Vercel can't hold a long-running loop (serverless) and
 * can't launch headless Chromium at the size the UX-check / QA agents need.
 * This process runs on Railway alongside the Postgres the app uses: it opens
 * the same `Job` table, drains the queue, and executes every pipeline stage
 * — including the Playwright-driven ones.
 *
 * It is intentionally thin: `ensureWorker()` already contains the recovery +
 * loop. This file is a long-lived host so Railway keeps the process alive and
 * so a graceful stop drains the current job before exit.
 */

import { ensureWorker } from "../src/lib/queue";

async function main() {
  // Fail fast if the DB URL isn't wired — a worker with no queue is worse
  // than a crash loop that makes the misconfig obvious.
  if (!process.env.DATABASE_URL) {
    console.error("[worker] DATABASE_URL is not set — nothing to drain.");
    process.exit(1);
  }

  console.log("[worker] starting; polling the Job table");
  ensureWorker();

  // Keep the process alive. ensureWorker's loop is detached (void), so we
  // park here on a never-resolving promise + a signal handler for graceful
  // stop. Any uncaught error inside the loop re-arms the worker on next
  // enqueue; a crash of this process is what Railway's restart policy covers.
  const stop = new Promise<void>((resolve) => {
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.on(sig, () => {
        console.log(`[worker] ${sig} received; exiting`);
        resolve();
      });
    }
  });
  await stop;
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
