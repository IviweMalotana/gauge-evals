"use client";

import Link from "next/link";
import useSWR from "swr";

import { fetcher } from "@/lib/api";
import type { Task } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

export default function TasksPage() {
  const { data, error, isLoading } = useSWR<Task[]>("/tasks", fetcher);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Each task is a prompt/system under test, evaluated against a dataset of cases."
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-4/5" />
              <Skeleton className="mt-4 h-3 w-24" />
            </Card>
          ))}
        </div>
      )}

      {error && <ErrorState message={(error as Error).message} />}

      {data && data.length === 0 && (
        <EmptyState
          title="No tasks yet"
          description="Seed the demo dataset with `make seed`, or create a task via the API."
        />
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="group">
              <Card className="h-full p-5 transition-all group-hover:border-border-strong group-hover:shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold tracking-tight text-fg">
                    {task.name}
                  </h2>
                  <span className="font-mono text-xs text-faint">{task.slug}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                  {task.description}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-faint">
                  Created {relativeTime(task.created_at)}
                  <span className="ml-auto inline-flex items-center gap-1 font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
