// QA P1-4 — Sensors page loading skeleton.

import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function SensorsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Filter row */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-light-grey bg-pure-white shadow-sm dark:border-dark-border dark:bg-dark-card">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-light-grey/80 px-4 py-3 dark:border-dark-border/80">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "flex-1"}`} animate={false} />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} cols={5} />
        ))}
      </div>
    </div>
  );
}
