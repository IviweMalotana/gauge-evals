"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import useSWR from "swr";

import { cn } from "@/lib/cn";
import { fetcher } from "@/lib/api";
import type { DatasetWithCases, RunSummary, TaskDetail } from "@/lib/types";
import { cost, pct, relativeTime } from "@/lib/format";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ScoreValue,
  Skeleton,
  StatusPill,
} from "@/components/ui";
import { CodeBlock } from "@/components/run-table";

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { data: task, error } = useSWR<TaskDetail>(`/tasks/${taskId}`, fetcher);
  const { data: runs } = useSWR<RunSummary[]>(`/tasks/${taskId}/runs`, fetcher);
  const datasetId = task?.datasets[0]?.id;
  const { data: dataset } = useSWR<DatasetWithCases>(
    datasetId ? `/datasets/${datasetId}` : null,
    fetcher,
  );

  if (error) return <ErrorState message={(error as Error).message} />;
  if (!task) {
    return (
      <>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-7 w-80" />
        <Skeleton className="mt-6 h-40 w-full rounded-lg" />
        <Skeleton className="mt-6 h-64 w-full rounded-lg" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link href="/tasks" className="hover:text-fg">
            ← Tasks
          </Link>
        }
        title={task.name}
        description={task.description}
      />

      {/* Setup */}
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">Task setup</h2>
          <span className="text-xs text-faint">the system under test</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CodeBlock label="System prompt">{task.system_prompt}</CodeBlock>
          <CodeBlock label="Prompt template">{task.prompt_template}</CodeBlock>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">
            Scorers
          </div>
          <div className="flex flex-wrap gap-2">
            {task.default_scorers.map((s) => (
              <Badge key={s.name} tone="accent">
                {s.name}
                <span className="font-normal opacity-70">· {s.type} · w{s.weight}</span>
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Runs */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Runs</h2>
          {runs && runs.length >= 2 && (
            <Link
              href={`/compare?task=${taskId}&base=${runs[1].id}&compare=${runs[0].id}`}
              className="inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
            >
              ⇄ Compare runs
            </Link>
          )}
        </div>
        {!runs ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : runs.length === 0 ? (
          <EmptyState title="No runs yet" description="Trigger a run to evaluate this task." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5">Run</th>
                  <th className="px-4 py-2.5">Model</th>
                  <th className="px-4 py-2.5 text-right">Pass rate</th>
                  <th className="px-4 py-2.5 text-right">Avg score</th>
                  <th className="px-4 py-2.5 text-right">Cost</th>
                  <th className="px-4 py-2.5 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/runs/${run.id}`} className="flex items-center gap-2">
                        <StatusPill status={run.status} />
                        <span className="font-medium text-fg hover:text-accent">{run.label}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{run.model}</td>
                    <td className="px-4 py-2.5 text-right tnum text-muted">
                      {pct(run.pass_rate)}{" "}
                      <span className="text-faint">
                        ({run.passed}/{run.total_cases})
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ScoreValue value={run.avg_score} />
                    </td>
                    <td className="px-4 py-2.5 text-right tnum text-muted">
                      {cost(run.total_cost_usd)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">
                      {relativeTime(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Dataset */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-fg">
          Dataset{" "}
          {dataset && (
            <span className="font-normal text-faint">
              · {dataset.name} · {dataset.cases.length} cases
            </span>
          )}
        </h2>
        {!dataset ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : (
          <DatasetTable dataset={dataset} />
        )}
      </section>
    </>
  );
}

function DatasetTable({ dataset }: { dataset: DatasetWithCases }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Case</th>
            <th className="px-3 py-2.5">Input</th>
            <th className="px-3 py-2.5 text-right">Grading</th>
          </tr>
        </thead>
        <tbody>
          {dataset.cases.map((c, i) => {
            const isOpen = open === c.id;
            return (
              <Fragment key={c.id}>
                <tr
                  onClick={() => setOpen(isOpen ? null : c.id)}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors hover:bg-surface-2",
                    isOpen && "bg-surface-2",
                  )}
                >
                  <td className="px-3 py-2.5 text-faint">
                    <svg
                      className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="tnum mr-2 text-xs text-faint">{i + 1}</span>
                    <span className="font-medium text-fg">{c.name}</span>
                  </td>
                  <td className="max-w-md px-3 py-2.5 text-muted">
                    {c.input.replace(/\s+/g, " ").slice(0, 90)}
                    {c.input.length > 90 ? "…" : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {c.expected && <Badge tone="neutral">expected</Badge>}{" "}
                    {c.rubric && <Badge tone="neutral">rubric</Badge>}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-border bg-surface-2/40">
                    <td colSpan={4} className="px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <CodeBlock label="Input">{c.input}</CodeBlock>
                        {c.expected && <CodeBlock label="Expected">{c.expected}</CodeBlock>}
                        {c.rubric && (
                          <div className="lg:col-span-2">
                            <CodeBlock label="Rubric">{c.rubric}</CodeBlock>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
