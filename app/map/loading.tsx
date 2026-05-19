// QA P1-4 — Map page loading skeleton.

import { Skeleton } from "@/components/ui/Skeleton";

export default function MapLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-light-grey bg-pure-white px-6 py-3 dark:border-dark-border dark:bg-dark-card">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Map area + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 bg-light-grey/30 dark:bg-dark-bg/50">
          <Skeleton className="h-full w-full rounded-none" animate={false} />
        </div>
        <div className="hidden w-80 flex-shrink-0 flex-col gap-3 border-l border-light-grey bg-pure-white p-4 md:flex dark:border-dark-border dark:bg-dark-card">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-light-grey/80 p-3 dark:border-dark-border/80"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
