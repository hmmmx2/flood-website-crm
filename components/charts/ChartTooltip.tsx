"use client";

import type { ReactNode } from "react";

/**
 * Shared chart tooltip surface — used by every Recharts chart in the CRM so
 * the dark-mode contrast story is solved in one place.
 *
 * The old per-chart `contentStyle` prop pushed body text into
 * `text-primary-blue` (#1d4ed8) on top of a near-black tooltip surface
 * (#16213e). Numeric values like coordinates and totals were essentially
 * invisible (≈ 3.2:1 contrast — fails WCAG AA).
 *
 * This component renders a card sitting on `--color-card-elevated` with
 * `--color-text` body copy (≈ 13:1 on the new dark page) and exposes a
 * tiny `Row` primitive so individual charts only specify what to show,
 * not how to colour it.
 */

export interface ChartTooltipShellProps {
  isDark: boolean;
  title?: ReactNode;
  children?: ReactNode;
  /** Optional extra padding for richer charts. */
  dense?: boolean;
}

export function ChartTooltipShell({ isDark, title, children, dense }: ChartTooltipShellProps) {
  return (
    <div
      style={{
        background: isDark ? "var(--color-card-elevated, #1c2128)" : "#ffffff",
        color: "var(--color-text)",
        border: `1px solid ${isDark ? "var(--color-border-strong, #484f58)" : "#cbd5e1"}`,
        borderRadius: 12,
        padding: dense ? "8px 10px" : "10px 12px",
        fontSize: 12,
        minWidth: 160,
        boxShadow: isDark
          ? "0 8px 24px -8px rgba(0,0,0,0.5)"
          : "0 8px 24px -8px rgba(15, 23, 42, 0.18)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {title !== undefined && (
        <div
          style={{
            fontWeight: 700,
            marginBottom: 6,
            color: "var(--color-text)",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export interface TooltipRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Optional swatch hex shown to the left of the label. */
  swatchHex?: string;
}

/**
 * Single label/value row used inside ChartTooltipShell.
 * Numeric values render in --color-text so they read against the surface.
 */
export function TooltipRow({ label, value, swatchHex }: TooltipRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--color-text-secondary, var(--color-text))",
        }}
      >
        {swatchHex && (
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: swatchHex,
              flexShrink: 0,
            }}
            aria-hidden
          />
        )}
        {label}
      </span>
      <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/**
 * Optional separator line for tooltips that group sections
 * (e.g. probability table beneath a level summary).
 */
export function TooltipDivider({ isDark }: { isDark: boolean }) {
  return (
    <div
      style={{
        marginTop: 6,
        marginBottom: 4,
        borderTop: `1px solid ${
          isDark ? "var(--color-border, #30363d)" : "#e4e4e7"
        }`,
      }}
    />
  );
}
