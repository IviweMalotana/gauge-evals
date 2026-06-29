import Link from "next/link";

export const metadata = {
  title: "Gauge — Evaluate & regression-test LLM apps",
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg">
      <SiteNav />
      <Hero />
      <Problem />
      <Approach />
      <HeroFeature />
      <Architecture />
      <Outcome />
      <TechStack />
      <CallToAction />
      <Footer />
    </div>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────── */

function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-20">
        {eyebrow && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">
            {eyebrow}
          </div>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h2>
        {intro && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{intro}</p>}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

function GaugeMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-lg bg-accent text-accent-fg shadow-sm"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 13.5 16.5 9M4.5 18a9 9 0 1 1 15 0"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────── */

function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <GaugeMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight">Gauge</span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted sm:flex">
          <a href="#problem" className="hover:text-fg">Problem</a>
          <a href="#approach" className="hover:text-fg">Approach</a>
          <a href="#architecture" className="hover:text-fg">Architecture</a>
        </nav>
        <Link
          href="/tasks"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
        >
          Open the app
        </Link>
      </div>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 70% -10%, var(--color-accent-soft), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Production AI tooling · live demo, no login
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl">
          Ship prompt and model changes without quietly breaking what already worked.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          Gauge is a lightweight harness for evaluating and regression-testing LLM apps. Define a
          task and a dataset, run it across every case with pluggable scorers — including an
          LLM-as-judge — and diff runs side by side so regressions are obvious before they reach a
          customer.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/tasks"
            className="inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
          >
            Open the live demo →
          </Link>
          <a
            href="#architecture"
            className="inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            See the architecture
          </a>
        </div>
        <p className="mt-4 text-sm text-faint">
          Seeded with a real dataset and run history — fully clickable the moment it loads.
        </p>
      </div>
    </section>
  );
}

/* ── Problem ─────────────────────────────────────────────────────────── */

function Problem() {
  const points = [
    {
      title: "LLM changes are silent",
      body: "A new model or a one-word prompt tweak can fix three cases and break two others. Without a harness, you find out from a customer.",
    },
    {
      title: "“It looks fine” doesn’t scale",
      body: "Eyeballing a handful of outputs misses regressions on the edge cases — nulls, odd formats, the inputs that actually break extraction.",
    },
    {
      title: "No record, no trend",
      body: "Teams change prompts weekly but keep no history, so they can’t answer “did quality go up or down?” — let alone which case regressed.",
    },
  ];
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="Prompt and model changes are a regression risk you can’t see"
      intro="Most teams test their code but not their LLM behaviour. The result is invisible drift: each change is plausible in isolation, and the breakage only shows up in aggregate."
    >
      <div className="grid gap-5 sm:grid-cols-3">
        {points.map((p) => (
          <div key={p.title} className="rounded-lg border border-border bg-surface p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-fg">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Approach ────────────────────────────────────────────────────────── */

function Approach() {
  const features = [
    {
      title: "Tasks & datasets",
      body: "Pin the system under test (prompt + template) against a versioned dataset of cases with expected outputs or grading rubrics.",
    },
    {
      title: "Pluggable scorers",
      body: "Exact-match, contains, regex, JSON-schema validity, and an LLM-as-judge that grades against a rubric and shows its reasoning.",
    },
    {
      title: "Every run stored",
      body: "Output, per-scorer score, pass/fail, latency, tokens, and cost are captured per case — a permanent, queryable record.",
    },
    {
      title: "Run-to-run diff",
      body: "Compare two runs side by side. Regressions in red, improvements in green, score deltas per case. The hero of the tool.",
    },
    {
      title: "Quality trend",
      body: "Score, cost, and latency over runs per task, so you can see whether a change moved the needle — and in which direction.",
    },
    {
      title: "Trigger & watch",
      body: "Kick off a run from the UI with a chosen model and params, and watch it execute case-by-case with live progress.",
    },
  ];
  return (
    <Section
      id="approach"
      eyebrow="The approach"
      title="Treat LLM behaviour like any other thing you regression-test"
      intro="Gauge borrows the discipline of automated testing — fixtures, assertions, a run record — and adapts it to non-deterministic model output with scorers built for it."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-surface p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Hero feature: the diff (static visual) ──────────────────────────── */

function HeroFeature() {
  return (
    <Section
      eyebrow="The hero feature"
      title="Regressions, obvious at a glance"
      intro="Pick two runs — say, after switching models. Gauge aligns them case-by-case and highlights exactly what changed, with the judge’s reasoning for every drop."
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5 text-xs text-muted">
          <span className="font-medium text-fg">Few-shot examples</span>
          <span>→</span>
          <span className="font-medium text-fg">Switched to Sonnet</span>
          <span className="ml-auto flex gap-3">
            <span className="text-success-fg">▲ 2 improved</span>
            <span className="text-danger-fg">▼ 1 regressed</span>
          </span>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <DiffRow name="Webinar follow-up — '$120K' budget parsing" base="0.05" comp="0.97" delta="+0.92" tone="improved" from="Fail" to="Pass" />
            <DiffRow name="Sparse message — nulls for company & email" base="0.97" comp="0.97" delta="·" tone="unchanged" from="Pass" to="Pass" />
            <DiffRow name="Praise, not a sales lead — intent 'other'" base="0.97" comp="0.54" delta="−0.43" tone="regressed" from="Pass" to="Fail" />
            <DiffRow name="Co-marketing — plus-addressed email" base="0.52" comp="0.97" delta="+0.46" tone="improved" from="Fail" to="Pass" />
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        A representative slice of the seeded demo — every row is live and expandable in the app.
      </p>
    </Section>
  );
}

function DiffRow({
  name,
  base,
  comp,
  delta,
  tone,
  from,
  to,
}: {
  name: string;
  base: string;
  comp: string;
  delta: string;
  tone: "improved" | "regressed" | "unchanged";
  from: string;
  to: string;
}) {
  const tint =
    tone === "regressed"
      ? "bg-danger-soft/60 border-l-2 border-danger"
      : tone === "improved"
        ? "bg-success-soft/60 border-l-2 border-success"
        : "border-l-2 border-transparent";
  const deltaColor =
    tone === "regressed" ? "text-danger-fg" : tone === "improved" ? "text-success-fg" : "text-faint";
  return (
    <tr className={`border-b border-border last:border-0 ${tint}`}>
      <td className="px-3 py-2.5 font-medium text-fg">{name}</td>
      <td className="px-3 py-2.5 text-right tnum text-muted">{base}</td>
      <td className="px-3 py-2.5 text-right tnum text-muted">{comp}</td>
      <td className={`px-3 py-2.5 text-right tnum font-medium ${deltaColor}`}>{delta}</td>
      <td className="px-3 py-2.5 text-right text-xs text-muted">
        {from} <span className="text-faint">→</span>{" "}
        <span className={tone === "regressed" ? "text-danger-fg" : tone === "improved" ? "text-success-fg" : ""}>
          {to}
        </span>
      </td>
    </tr>
  );
}

/* ── Architecture ────────────────────────────────────────────────────── */

function Architecture() {
  return (
    <Section
      id="architecture"
      eyebrow="The architecture"
      title="Typed end-to-end, deployable in two clicks"
      intro="A clean split: a Next.js operator UI on Vercel, a FastAPI engine on Railway, Postgres for the run record, and the Anthropic API for execution and judging — with a deterministic mock so the demo needs no key."
    >
      <div className="rounded-lg border border-border bg-surface p-6 shadow-xs sm:p-8">
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          <ArchBox
            title="web/"
            subtitle="Next.js 15 · TypeScript · Tailwind"
            lines={["Tasks · runs · diff · trends", "Trigger runs, watch live"]}
            tag="Vercel"
          />
          <Connector label="HTTP / JSON" />
          <ArchBox
            title="api/"
            subtitle="FastAPI · Python 3.12"
            lines={["Run engine + scorers", "Anthropic SDK / mock", "SQLAlchemy + Alembic"]}
            tag="Railway"
            accent
          />
          <Connector label="SQL" />
          <ArchBox
            title="Postgres"
            subtitle="run record"
            lines={["tasks · datasets · cases", "runs · results"]}
            tag="Railway"
          />
        </div>
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-md border border-dashed border-accent-border bg-accent-soft px-3 py-1.5 text-xs text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            api/ → Anthropic Claude API (execution + LLM-as-judge) · falls back to a deterministic
            mock when no key is set
          </div>
        </div>
      </div>
    </Section>
  );
}

function ArchBox({
  title,
  subtitle,
  lines,
  tag,
  accent,
}: {
  title: string;
  subtitle: string;
  lines: string[];
  tag: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-lg border bg-surface-2 p-4 ${
        accent ? "border-accent-border" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-fg">{title}</span>
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
          {tag}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
      <ul className="mt-3 space-y-1">
        {lines.map((l) => (
          <li key={l} className="text-xs text-faint">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 lg:w-20">
      <span className="text-[10px] font-medium uppercase tracking-wide text-faint">{label}</span>
      <span className="text-border-strong">
        <svg width="40" height="12" viewBox="0 0 40 12" fill="none" className="hidden lg:block">
          <path d="M0 6h34m0 0-5-4m5 4-5 4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <svg width="12" height="24" viewBox="0 0 12 24" fill="none" className="lg:hidden">
          <path d="M6 0v18m0 0-4-5m4 5 4-5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
    </div>
  );
}

/* ── Outcome (with placeholder metrics) ──────────────────────────────── */

function Outcome() {
  // NOTE: These are placeholders. Replace the `value` strings below with your
  // own real numbers from using Gauge / shipping production AI systems.
  const metrics = [
    { value: "—", label: "Regressions caught before shipping", hint: "e.g. “6 in the first month”" },
    { value: "—", label: "Faster eval iteration vs. manual review", hint: "e.g. “~10× faster”" },
    { value: "—", label: "Cost per full eval run", hint: "e.g. “$0.01 on Sonnet”" },
    { value: "—", label: "Prompt/model changes evaluated", hint: "e.g. “40+ across 3 tasks”" },
  ];
  return (
    <Section
      eyebrow="The outcome"
      title="From “looks fine” to a number you can defend"
      intro="With a run record and a diff, every prompt or model change comes with evidence: what improved, what regressed, and what it cost."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-dashed border-border-strong bg-surface-2/50 p-5"
          >
            <div className="text-3xl font-semibold tracking-tight text-faint">{m.value}</div>
            <div className="mt-2 text-sm font-medium text-fg">{m.label}</div>
            <div className="mt-2 inline-block rounded border border-dashed border-accent-border px-1.5 py-0.5 text-[11px] text-accent">
              placeholder — {m.hint}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
        <span className="font-medium text-fg">Why this project:</span> it’s the tool I use to
        maintain my other production AI systems. Building it signals that I ship evaluated,
        regression-tested AI — not prototypes.
      </p>
    </Section>
  );
}

/* ── Tech stack ──────────────────────────────────────────────────────── */

function TechStack() {
  const stack = [
    "Next.js 15",
    "TypeScript",
    "Tailwind CSS",
    "FastAPI",
    "Python 3.12",
    "SQLAlchemy",
    "Alembic",
    "PostgreSQL",
    "Anthropic Claude",
    "Recharts",
    "Vercel",
    "Railway",
  ];
  return (
    <Section eyebrow="Built with" title="A deliberate, production-grade stack">
      <div className="flex flex-wrap gap-2">
        {stack.map((s) => (
          <span
            key={s}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted"
          >
            {s}
          </span>
        ))}
      </div>
    </Section>
  );
}

/* ── CTA + footer ────────────────────────────────────────────────────── */

function CallToAction() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          See it in action
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted">
          The demo is seeded and live — open a task, trigger a run, and diff it against the history.
          No setup, no login.
        </p>
        <Link
          href="/tasks"
          className="mt-8 inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
        >
          Open the dashboard →
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-faint sm:flex-row">
        <div className="flex items-center gap-2">
          <GaugeMark size={22} />
          <span className="font-medium text-muted">Gauge</span>
          <span>— an LLM eval & regression-testing harness</span>
        </div>
        <span>A portfolio case study · built to production standards</span>
      </div>
    </footer>
  );
}
