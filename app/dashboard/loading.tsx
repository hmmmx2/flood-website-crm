// QA P1-4 — Dashboard loading skeleton.
//
// Renders BEFORE React hydrates so operators on slow networks see a
// structurally accurate placeholder instead of bare "..." text or a
// jarring blank panel. Matches the real dashboard's layout: KPI tile
// strip across the top + two side-by-side chart panels.

import { Skeleton, SkeletonKpiTile } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* KPI strip — 4 tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKpiTile />
        <SkeletonKpiTile />
        <SkeletonKpiTile />
        <SkeletonKpiTile />
      </div>

      {/* Two chart panels */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-light-grey bg-pure-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-60 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
