"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";

import { apiPost, fetcher } from "@/lib/api";
import type { Meta, RunSummary } from "@/lib/types";

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fast & cheap" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — most capable" },
  { id: "claude-fable-5", label: "Fable 5 — frontier" },
];

const NO_TEMP = ["claude-opus-4-8", "claude-opus-4-7", "claude-fable-5", "claude-mythos-5"];

export function TriggerRunDialog({
  taskId,
  open,
  onClose,
}: {
  taskId: number | string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: meta } = useSWR<Meta>("/meta", fetcher);
  const [model, setModel] = useState("");
  const [label, setLabel] = useState("");
  const [temperature, setTemperature] = useState(0);
  const [maxTokens, setMaxTokens] = useState(400);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meta && !model) setModel(meta.default_model);
  }, [meta, model]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const tempDisabled = NO_TEMP.includes(model);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const params: Record<string, number> = { max_tokens: maxTokens };
      if (!tempDisabled) params.temperature = temperature;
      const run = await apiPost<RunSummary>("/runs", {
        task_id: Number(taskId),
        model,
        label: label.trim() || undefined,
        params,
      });
      router.push(`/runs/${run.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[hsl(222_28%_12%_/_0.35)] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight text-fg">New run</h2>
          <p className="mt-0.5 text-sm text-muted">
            Run this task across every case and score the outputs.
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Field label="Model">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Label (optional)">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Tightened JSON instructions"
              className="h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-accent"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Temperature${tempDisabled ? " (n/a)" : ""}`}>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                disabled={tempDisabled}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint"
              />
            </Field>
            <Field label="Max tokens">
              <input
                type="number"
                step="50"
                min="1"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-border-strong bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent"
              />
            </Field>
          </div>

          {meta?.demo_mode && (
            <p className="rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-xs text-muted">
              <span className="font-medium text-accent">Demo mode:</span> outputs come from a
              deterministic mock — model choice is recorded but no real API call is made.
            </p>
          )}

          {error && (
            <p className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger-fg">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="h-9 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !model}
            className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting ? "Starting…" : "Run task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}
