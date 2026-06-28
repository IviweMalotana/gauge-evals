"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { RunDetail } from "@/lib/types";
import { cost, dateTime, duration, latency, pct, tokens } from "@/lib/format";
import {
  Badge,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  Stat,
  StatusPill,
} from "@/components/ui";
import { RunTable } from "@/components/run-table";

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, error } = useSWR<RunDetail>(`/runs/${runId}`, fetcher, {
    refreshInterval: (latest) =>
      latest && (latest.status === "running" || latest.status === "queued") ? 1000 : 0,
  });

  if (error) return <ErrorState message={(error as Error).message} />;

  if (!run) {
    return (
      <>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-7 w-72" />
        <Card className="mt-6 p-5">
          <div className="grid grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </Card>
        <Skeleton className="mt-6 h-64 w-full rounded-lg" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href={`/tasks/${run.task_id}`} className="hover:text-fg">
            ← Back to task
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {run.label}
            <StatusPill status={run.status} />
            {run.is_mock && <Badge tone="neutral">mock</Badge>}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs">{run.model}</span>
            <span>·</span>
            <span>{dateTime(run.created_at)}</span>
            {run.finished_at && (
              <>
                <span>·</span>
                <span>ran in {duration(run.started_at, run.finished_at)}</span>
              </>
            )}
          </span>
        }
      />

      {run.status === "failed" && run.error && (
        <div className="mb-6">
          <ErrorState message={run.error} />
        </div>
      )}

      {(run.status === "running" || run.status === "queued") && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-fg">
              Running case {run.progress_done} of {run.progress_total}…
            </span>
            <span className="tnum text-muted">
              {run.progress_total
                ? pct(run.progress_done / run.progress_total)
                : "0%"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{
                width: `${run.progress_total ? (run.progress_done / run.progress_total) * 100 : 4}%`,
              }}
            />
          </div>
        </Card>
      )}

      <Card className="mb-6 grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Pass rate"
          value={pct(run.pass_rate)}
          sub={`${run.passed}/${run.total_cases} cases`}
        />
        <Stat label="Avg score" value={run.avg_score.toFixed(2)} />
        <Stat label="Failures" value={run.failed} sub={run.error_count ? `${run.error_count} errored` : undefined} />
        <Stat label="Avg latency" value={latency(run.avg_latency_ms)} />
        <Stat label="Total cost" value={cost(run.total_cost_usd)} />
        <Stat
          label="Tokens"
          value={tokens(run.total_input_tokens + run.total_output_tokens)}
          sub={`${tokens(run.total_input_tokens)} in / ${tokens(run.total_output_tokens)} out`}
        />
      </Card>

      {run.results.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          No results yet — the run is still starting.
        </Card>
      ) : (
        <RunTable run={run} />
      )}
    </>
  );
}
