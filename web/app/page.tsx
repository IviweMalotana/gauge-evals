import Link from "next/link";

/**
 * Placeholder landing page (Milestone 0).
 * Replaced by the full case-study landing in Milestone 7.
 */
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <GaugeMark />
          <span className="text-lg font-semibold tracking-tight">Gauge</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Evaluate &amp; regression-test your LLM apps
        </h1>
        <p className="mt-4 text-muted leading-relaxed text-balance">
          Define tasks and datasets, score outputs with pluggable scorers, and
          diff runs side by side to catch regressions before they ship.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/tasks"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Open the dashboard
          </Link>
          <a
            href="http://localhost:8000/docs"
            className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            API docs
          </a>
        </div>
        <p className="mt-10 text-xs text-faint">
          Milestone 0 — scaffold is live. Full product UI lands in later
          milestones.
        </p>
      </div>
    </main>
  );
}

function GaugeMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-fg shadow-sm">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 13.5 16.5 9M4.5 18a9 9 0 1 1 15 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
