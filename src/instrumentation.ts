/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Starts the background job worker so any queued (or interrupted) pipeline work
 * resumes on startup, not just when a new request comes in.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // When EXTERNAL_WORKER=true the queue is drained by a separate worker
  // process (see scripts/worker.ts). Starting the in-process loop as well
  // means two workers racing on the same Job rows — the schema's "claim" is
  // optimistic but the duplicate work still shows up as doubled agent runs
  // and doubled LLM spend. On Vercel the serverless runtime can't hold the
  // loop anyway, so this flag is required there.
  if (process.env.EXTERNAL_WORKER === "true") return;
  const { ensureWorker } = await import("./lib/queue");
  ensureWorker();
}
