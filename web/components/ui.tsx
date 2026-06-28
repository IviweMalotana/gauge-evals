import { cn } from "@/lib/cn";
import type { RunStatus } from "@/lib/types";

/* ── Card ─────────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

/* ── Skeleton ─────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

/* ── Empty & error states ─────────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-2/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger-fg">
      <span className="font-medium">Something went wrong.</span> {message}
    </div>
  );
}

/* ── Badge ────────────────────────────────────────────────────────────── */

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent-border",
  success: "bg-success-soft text-success-fg border-success-border",
  danger: "bg-danger-soft text-danger-fg border-danger-border",
  warning: "bg-warning-soft text-[color:var(--color-warning)] border-warning-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Pass / fail ──────────────────────────────────────────────────────── */

export function PassFail({ passed }: { passed: boolean }) {
  return (
    <Badge tone={passed ? "success" : "danger"}>
      <span className={cn("h-1.5 w-1.5 rounded-full", passed ? "bg-success" : "bg-danger")} />
      {passed ? "Pass" : "Fail"}
    </Badge>
  );
}

/* ── Score: colored value + thin bar ──────────────────────────────────── */

function scoreTone(s: number): Tone {
  if (s >= 0.7) return "success";
  if (s >= 0.4) return "warning";
  return "danger";
}

const barColor: Record<Tone, string> = {
  neutral: "bg-border-strong",
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-[color:var(--color-warning)]",
};

export function ScoreValue({ value }: { value: number }) {
  const tone = scoreTone(value);
  const color =
    tone === "success" ? "text-success-fg" : tone === "warning" ? "text-[color:var(--color-warning)]" : "text-danger-fg";
  return <span className={cn("tnum font-medium", color)}>{value.toFixed(2)}</span>;
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const tone = scoreTone(value);
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className={cn("h-full rounded-full transition-all", barColor[tone])}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

/* ── Run status pill ──────────────────────────────────────────────────── */

const statusTone: Record<RunStatus, Tone> = {
  queued: "neutral",
  running: "accent",
  completed: "success",
  failed: "danger",
};

export function StatusPill({ status }: { status: RunStatus }) {
  return (
    <Badge tone={statusTone[status]} className="capitalize">
      {status === "running" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      )}
      {status}
    </Badge>
  );
}

/* ── Stat (compact metric) ────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight tnum text-fg">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/* ── Page header ──────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {breadcrumb && <div className="mb-2 text-sm text-muted">{breadcrumb}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
