"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import type { RunDetail, ResultWithCase, ScoreEntry } from "@/lib/types";
import { cost, latency, tokens } from "@/lib/format";
import { PassFail, ScoreValue } from "@/components/ui";

export function CodeBlock({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">{label}</div>
      )}
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-fg">
        {children}
      </pre>
    </div>
  );
}

function preview(text: string | null, n = 96): string {
  if (!text) return "—";
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}

function ScorerCell({ score }: { score?: ScoreEntry }) {
  if (!score) return <span className="text-faint">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          score.passed ? "bg-success" : "bg-danger",
        )}
      />
      <ScoreValue value={score.score} />
    </div>
  );
}

export function RunTable({ run }: { run: RunDetail }) {
  const [open, setOpen] = useState<number | null>(null);
  const scorerCols = run.scorers ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-faint">
            <th className="w-8 px-3 py-2.5" />
            <th className="px-3 py-2.5">Case</th>
            <th className="px-3 py-2.5">Output</th>
            {scorerCols.map((s) => (
              <th key={s.name} className="px-3 py-2.5 text-right">
                {s.name}
              </th>
            ))}
            <th className="px-3 py-2.5 text-center">Result</th>
            <th className="px-3 py-2.5 text-right">Latency</th>
            <th className="px-3 py-2.5 text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {run.results.map((r, i) => {
            const isOpen = open === r.id;
            const byName = new Map(r.scores.map((s) => [s.name, s]));
            return (
              <RowGroup
                key={r.id}
                result={r}
                index={i}
                isOpen={isOpen}
                onToggle={() => setOpen(isOpen ? null : r.id)}
                scorerCols={scorerCols.map((s) => byName.get(s.name))}
                colSpan={4 + scorerCols.length}
                inputLabel="Input"
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  result,
  index,
  isOpen,
  onToggle,
  scorerCols,
  colSpan,
}: {
  result: ResultWithCase;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  scorerCols: (ScoreEntry | undefined)[];
  colSpan: number;
  inputLabel: string;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
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
          <div className="flex items-center gap-2">
            <span className="tnum text-xs text-faint">{index + 1}</span>
            <span className="font-medium text-fg">{result.case.name}</span>
          </div>
        </td>
        <td className="max-w-xs px-3 py-2.5">
          {result.error ? (
            <span className="text-danger-fg">{preview(result.error, 60)}</span>
          ) : (
            <span className="font-mono text-xs text-muted">{preview(result.output)}</span>
          )}
        </td>
        {scorerCols.map((s, idx) => (
          <td key={idx} className="px-3 py-2.5 text-right">
            <div className="flex justify-end">
              <ScorerCell score={s} />
            </div>
          </td>
        ))}
        <td className="px-3 py-2.5 text-center">
          <div className="flex justify-center">
            {result.error ? <PassFail passed={false} /> : <PassFail passed={result.passed} />}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tnum text-muted">
          {result.error ? "—" : latency(result.latency_ms)}
        </td>
        <td className="px-3 py-2.5 text-right tnum text-muted">
          {result.error ? "—" : cost(result.cost_usd)}
        </td>
      </tr>

      {isOpen && (
        <tr className="border-b border-border bg-surface-2/40">
          <td colSpan={colSpan} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <CodeBlock label="Input">{result.case.input}</CodeBlock>
              {result.error ? (
                <CodeBlock label="Error">{result.error}</CodeBlock>
              ) : (
                <CodeBlock label="Output">{result.output || "(empty)"}</CodeBlock>
              )}
              {result.case.expected && (
                <CodeBlock label="Expected">{result.case.expected}</CodeBlock>
              )}
              <div>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
                  Scorers
                </div>
                <div className="space-y-2">
                  {result.scores.length === 0 && (
                    <p className="text-xs text-muted">No scorers ran for this case.</p>
                  )}
                  {result.scores.map((s) => (
                    <div
                      key={s.name}
                      className="rounded-md border border-border bg-surface p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-fg">
                          {s.name}
                          <span className="ml-1.5 font-normal text-faint">
                            ({s.type} · w{s.weight})
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <ScoreValue value={s.score} />
                          <PassFail passed={s.passed} />
                        </div>
                      </div>
                      {(s.reasoning || s.detail) && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">
                          {s.reasoning || s.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-faint">
              <span>
                {tokens(result.input_tokens)} in / {tokens(result.output_tokens)} out tokens
              </span>
              <span>latency {latency(result.latency_ms)}</span>
              <span>cost {cost(result.cost_usd)}</span>
              <span>
                overall <ScoreValue value={result.score} />
              </span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
