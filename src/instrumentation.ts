/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * Starts the background job worker so any queued (or interrupted) pipeline work
 * resumes on startup, not just when a new request comes in.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureWorker } = await import("./lib/queue");
    ensureWorker();
  }
}
