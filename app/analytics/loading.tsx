// QA P1-4 — Analytics page loading skeleton.

import { Skeleton } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-44" />
      </div>

      {/* Summary number row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-light-grey bg-pure-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card"
          >
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-light-grey bg-pure-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card"
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-4 h-56 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
