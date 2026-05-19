// QA P1-4 — Tiny skeleton primitive used by per-route `loading.tsx`
// fallbacks. Server-component-safe (no client hooks). Brand-aware:
// reads CSS variables already wired by ThemeContext / globals.css so
// dark mode is automatic.

import { ReactNode } from "react";

type SkeletonProps = {
  className?: string;
  children?: ReactNode;
  /**
   * Add the pulse animation. Defaults to `true`. Set `false` for
   * placeholders inside an already-animating parent (avoids the
   * cascade-pulse "shimmer of shimmers" look).
   */
  animate?: boolean;
};

/**
 * Neutral grey block. Use as a placeholder for any forthcoming
 * content shape. Combine width + height utility classes to size it
 * to the target element.
 */
export function Skeleton({ className = "", children, animate = true }: SkeletonProps) {
  return (
    <div
      className={[
        "rounded-lg bg-light-grey/60 dark:bg-dark-border/60",
        animate ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/** KPI tile placeholder — used by the dashboard skeleton. */
export function SkeletonKpiTile() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-light-grey bg-pure-white p-5 shadow-sm dark:border-dark-border dark:bg-dark-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

/** A single row in a table skeleton. */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-light-grey/60 px-4 py-3 dark:border-dark-border/60">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? "w-32" : "flex-1"}`} />
      ))}
    </div>
  );
}
