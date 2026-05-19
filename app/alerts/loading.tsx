// QA P1-4 — Alerts page loading skeleton.

import { Skeleton } from "@/components/ui/Skeleton";

export default function AlertsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Severity filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      {/* Alert list — card rows with a coloured left-bar placeholder */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-2xl border border-light-grey bg-pure-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card"
          >
            <Skeleton className="w-1 self-stretch rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-24 self-center" />
          </div>
        ))}
      </div>
    </div>
  );
}
