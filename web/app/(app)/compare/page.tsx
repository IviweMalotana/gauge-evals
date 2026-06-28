"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { CompareResponse, RunSummary } from "@/lib/types";
import { cost, latency, pct } from "@/lib/format";
import {
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  Stat,
} from "@/components/ui";
import { DiffTable } from "@/components/diff-table";

export default function ComparePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
      <CompareView />
    </Suspense>
  );
}

function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const taskId = params.get("task");
  const base = params.get("base");
  const compare = params.get("compare");

  const { data: runs } = useSWR<RunSummary[]>(
    taskId ? `/tasks/${taskId}/runs` : null,
    fetcher,
  );
  const { data, error } = useSWR<CompareResponse>(
    base && compare ? `/runs/${base}/compare/${compare}` : null,
    fetcher,
  );

  const setParam = (key: "base" | "compare", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.replace(`/compare?${next.toString()}`);
  };

  const swap = () => {
    if (!base || !compare) return;
    const next = new URLSearchParams(params.toString());
    next.set("base", compare);
    next.set("compare", base);
    router.replace(`/compare?${next.toString()}`);
  };

  return (
    <>
      <PageHeader
        breadcrumb={
          taskId ? (
            <Link href={`/tasks/${taskId}`} className="hover:text-fg">
              ← Back to task
            </Link>
          ) : (
            <Link href="/tasks" className="hover:text-fg">
              ← Tasks
            </Link>
          )
        }
        title="Compare runs"
        description="Regressions are highlighted in red, improvements in green — at a glance."
      />

      {/* Run pickers */}
      <Card className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <RunPicker
          label="Base run"
          value={base}
          runs={runs}
          onChange={(v) => setParam("base", v)}
        />
        <button
          onClick={swap}
          className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center self-center rounded-md border border-border-strong bg-surface text-muted transition-colors hover:bg-surface-2 sm:self-end"
          title="Swap base and compare"
          aria-label="Swap"
        >
          ⇄
        </button>
        <RunPicker
          label="Compare run"
          value={compare}
          runs={runs}
          onChange={(v) => setParam("compare", v)}
        />
      </Card>

      {error && <ErrorState message={(error as Error).message} />}

      {!base || !compare ? (
        <Card className="p-8 text-center text-sm text-muted">
          Pick two runs to compare.
        </Card>
      ) : !data ? (
        <>
          <Skeleton className="mb-6 h-24 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </>
      ) : (
        <>
          <SummaryStrip data={data} />
          <DiffTable data={data} />
        </>
      )}
    </>
  );
}

function RunPicker({
  label,
  value,
  runs,
  onChange,
}: {
  label: string;
  value: string | null;
  runs?: RunSummary[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent"
      >
        <option value="" disabled>
          Select a run…
        </option>
        {runs?.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label} — {r.model} ({pct(r.pass_rate)})
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryStrip({ data }: { data: CompareResponse }) {
  const s = data.summary;
  const deltaStr = (n: number, digits = 2) => (n > 0 ? "+" : "") + n.toFixed(digits);
  return (
    <Card className="mb-6 grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
      <Stat
        label="Regressed"
        value={<span className={s.regressed ? "text-danger-fg" : undefined}>{s.regressed}</span>}
        sub="pass → fail"
      />
      <Stat
        label="Improved"
        value={<span className={s.improved ? "text-success-fg" : undefined}>{s.improved}</span>}
        sub="fail → pass"
      />
      <Stat label="Unchanged" value={s.unchanged} />
      <Stat
        label="Avg score Δ"
        value={
          <span className={s.score_delta >= 0 ? "text-success-fg" : "text-danger-fg"}>
            {deltaStr(s.score_delta)}
          </span>
        }
      />
      <Stat
        label="Pass count Δ"
        value={
          <span className={s.passed_delta >= 0 ? "text-success-fg" : "text-danger-fg"}>
            {s.passed_delta > 0 ? "+" : ""}
            {s.passed_delta}
          </span>
        }
      />
      <Stat
        label="Cost Δ"
        value={
          <span className={s.cost_delta <= 0 ? "text-success-fg" : "text-fg"}>
            {s.cost_delta > 0 ? "+" : ""}
            {cost(s.cost_delta)}
          </span>
        }
        sub={`latency ${s.latency_delta > 0 ? "+" : ""}${latency(Math.abs(s.latency_delta))}`}
      />
    </Card>
  );
}
