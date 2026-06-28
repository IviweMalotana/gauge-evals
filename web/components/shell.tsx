"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";

import { cn } from "@/lib/cn";
import { fetcher } from "@/lib/api";
import type { Meta } from "@/lib/types";
import { Badge } from "@/components/ui";

function GaugeMark() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-fg shadow-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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

const NAV = [{ href: "/tasks", label: "Tasks", icon: TasksIcon }];

export function Sidebar() {
  const pathname = usePathname();
  const { data: meta } = useSWR<Meta>("/meta", fetcher);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-border bg-surface">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <GaugeMark />
        <span className="text-[15px] font-semibold tracking-tight">Gauge</span>
        <span className="ml-auto text-xs text-faint">eval harness</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-faint")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-3">
        {meta?.demo_mode ? (
          <div className="rounded-md border border-accent-border bg-accent-soft px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Demo mode
            </div>
            <p className="mt-1 text-xs leading-snug text-muted">
              Runs use a deterministic mock model — no API key required.
            </p>
          </div>
        ) : meta ? (
          <Badge tone="success">Live model connected</Badge>
        ) : null}
        <p className="px-1 text-xs text-faint">
          Default model
          <br />
          <span className="font-mono text-[11px] text-muted">{meta?.default_model ?? "…"}</span>
        </p>
      </div>
    </aside>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
