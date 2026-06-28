"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/cn";
import type { RunSummary } from "@/lib/types";
import { cost, dateTime, latency, pct } from "@/lib/format";
import { EmptyState } from "@/components/ui";

// Palette aligned with the design tokens (Recharts needs literal colors).
const ACCENT = "#5b5bd6";
const SUCCESS = "#16a34a";
const WARNING = "#d97706";
const GRID = "#e9ebf0";
const AXIS = "#9aa1ad";

type Metric = "score" | "cost" | "latency";

const METRICS: { key: Metric; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "cost", label: "Cost" },
  { key: "latency", label: "Latency" },
];

interface Point {
  i: number;
  label: string;
  model: string;
  createdAt: string;
  avgScore: number;
  passRate: number;
  cost: number;
  latency: number;
}

export function TrendChart({ runs }: { runs: RunSummary[] }) {
  const [metric, setMetric] = useState<Metric>("score");

  const data: Point[] = useMemo(
    () =>
      runs
        .filter((r) => r.status === "completed")
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((r, i) => ({
          i: i + 1,
          label: r.label,
          model: r.model,
          createdAt: r.created_at,
          avgScore: r.avg_score,
          passRate: r.pass_rate,
          cost: r.total_cost_usd,
          latency: r.avg_latency_ms,
        })),
    [runs],
  );

  if (data.length < 2) {
    return (
      <EmptyState
        title="Not enough runs to chart a trend"
        description="Trigger at least two runs to see quality move over time."
      />
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 text-xs">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                metric === m.key
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {metric === "score" && (
          <div className="flex items-center gap-4 text-xs text-muted">
            <Legend color={ACCENT} label="Avg score" />
            <Legend color={SUCCESS} label="Pass rate" />
          </div>
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="i"
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickFormatter={(v) => `#${v}`}
            />
            <YAxis
              tick={{ fill: AXIS, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={metric === "score" ? [0, 1] : ["auto", "auto"]}
              tickFormatter={(v) =>
                metric === "score" ? v.toFixed(1) : metric === "cost" ? cost(v) : latency(v)
              }
            />
            <Tooltip content={<TrendTooltip metric={metric} />} />
            {metric === "score" && (
              <Line
                key="avgScore"
                isAnimationActive={false}
                type="monotone"
                dataKey="avgScore"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT }}
                activeDot={{ r: 5 }}
              />
            )}
            {metric === "score" && (
              <Line
                key="passRate"
                isAnimationActive={false}
                type="monotone"
                dataKey="passRate"
                stroke={SUCCESS}
                strokeWidth={2}
                dot={{ r: 3, fill: SUCCESS }}
                activeDot={{ r: 5 }}
              />
            )}
            {metric === "cost" && (
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="cost"
                stroke={WARNING}
                strokeWidth={2}
                dot={{ r: 3, fill: WARNING }}
                activeDot={{ r: 5 }}
              />
            )}
            {metric === "latency" && (
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="latency"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Point }[];
  metric: Metric;
}

function TrendTooltip({ active, payload, metric }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-fg">{p.label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-faint">{p.model}</div>
      <div className="mt-1.5 space-y-0.5 text-muted">
        {metric === "score" && (
          <>
            <div>
              Avg score <span className="tnum font-medium text-fg">{p.avgScore.toFixed(2)}</span>
            </div>
            <div>
              Pass rate <span className="tnum font-medium text-fg">{pct(p.passRate)}</span>
            </div>
          </>
        )}
        {metric === "cost" && (
          <div>
            Total cost <span className="tnum font-medium text-fg">{cost(p.cost)}</span>
          </div>
        )}
        {metric === "latency" && (
          <div>
            Avg latency <span className="tnum font-medium text-fg">{latency(p.latency)}</span>
          </div>
        )}
        <div className="text-faint">{dateTime(p.createdAt)}</div>
      </div>
    </div>
  );
}
