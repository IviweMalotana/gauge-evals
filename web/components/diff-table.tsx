"use client";

import { Fragment, useState } from "react";

import { cn } from "@/lib/cn";
import type { CompareCaseRow, CompareResponse, DiffStatus, Result } from "@/lib/types";
import { cost, latency } from "@/lib/format";
import { PassFail, ScoreValue } from "@/components/ui";
import { CodeBlock } from "@/components/run-table";

const rowTint: Record<DiffStatus, string> = {
  regressed: "bg-danger-soft/60 hover:bg-danger-soft",
  improved: "bg-success-soft/60 hover:bg-success-soft",
  unchanged: "hover:bg-surface-2",
  missing: "hover:bg-surface-2",
};

const accent: Record<DiffStatus, string> = {
  regressed: "border-l-2 border-danger",
  improved: "border-l-2 border-success",
  unchanged: "border-l-2 border-transparent",
  missing: "border-l-2 border-transparent",
};

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  if (Math.abs(value) < 0.0005) return <span className="tnum text-faint">·</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={cn("tnum font-medium", good ? "text-success-fg" : "text-danger-fg")}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
}

function StatusTag({ status }: { status: DiffStatus }) {
  if (status === "improved")
    return <span className="text-xs font-medium text-success-fg">▲ improved</span>;
  if (status === "regressed")
    return <span className="text-xs font-medium text-danger-fg">▼ regressed</span>;
  return <span className="text-xs text-faint">unchanged</span>;
}

export function DiffTable({ data }: { data: CompareResponse }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Case</th>
            <th className="px-3 py-2.5 text-right">Base</th>
            <th className="px-3 py-2.5 text-right">Compare</th>
            <th className="px-3 py-2.5 text-right">Δ score</th>
            <th className="px-3 py-2.5 text-right">Result</th>
            <th className="px-3 py-2.5 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => {
            const isOpen = open === row.case.id;
            return (
              <Fragment key={row.case.id}>
                <tr
                  onClick={() => setOpen(isOpen ? null : row.case.id)}
                  className={cn(
                    "cursor-pointer border-b border-border transition-colors",
                    rowTint[row.status],
                    accent[row.status],
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
                    <span className="font-medium text-fg">{row.case.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.base ? <ScoreValue value={row.base.score} /> : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.compare ? (
                      <ScoreValue value={row.compare.score} />
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Delta value={row.score_delta} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5 text-xs">
                      {row.base && <PassFail passed={row.base.passed} />}
                      <span className="text-faint">→</span>
                      {row.compare && <PassFail passed={row.compare.passed} />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <StatusTag status={row.status} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className={cn("border-b border-border", rowTint[row.status])}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="mb-4">
                        <CodeBlock label="Input">{row.case.input}</CodeBlock>
                        {row.case.expected && (
                          <div className="mt-3">
                            <CodeBlock label="Expected">{row.case.expected}</CodeBlock>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <SidePanel title={`Base · ${data.base.label}`} result={row.base} />
                        <SidePanel
                          title={`Compare · ${data.compare.label}`}
                          result={row.compare}
                          highlight={row.status}
                        />
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

function SidePanel({
  title,
  result,
  highlight,
}: {
  title: string;
  result: Result | null;
  highlight?: DiffStatus;
}) {
  const ring =
    highlight === "regressed"
      ? "ring-1 ring-danger-border"
      : highlight === "improved"
        ? "ring-1 ring-success-border"
        : "";
  return (
    <div className={cn("rounded-md border border-border bg-surface p-3", ring)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg">{title}</span>
        {result && (
          <div className="flex items-center gap-2">
            <ScoreValue value={result.score} />
            <PassFail passed={result.passed} />
          </div>
        )}
      </div>
      {!result ? (
        <p className="text-xs text-faint">No result in this run.</p>
      ) : result.error ? (
        <CodeBlock label="Error">{result.error}</CodeBlock>
      ) : (
        <>
          <CodeBlock label="Output">{result.output || "(empty)"}</CodeBlock>
          <div className="mt-2 space-y-1.5">
            {result.scores.map((s) => (
              <div key={s.name} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-fg">{s.name}</span>
                  <span className="flex items-center gap-1.5">
                    <ScoreValue value={s.score} />
                    <span className={s.passed ? "text-success-fg" : "text-danger-fg"}>
                      {s.passed ? "pass" : "fail"}
                    </span>
                  </span>
                </div>
                {(s.reasoning || s.detail) && (
                  <p className="mt-0.5 leading-snug text-muted">{s.reasoning || s.detail}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-faint">
            <span>{latency(result.latency_ms)}</span>
            <span>{cost(result.cost_usd)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export type { CompareCaseRow };
