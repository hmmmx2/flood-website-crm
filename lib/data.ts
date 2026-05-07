/**
 * lib/data.ts — UI constants only.
 *
 * ⚠️  All hardcoded data arrays (nodes, alerts, sensor readings, trend series)
 * have been removed. Live data now comes from the Neon PostgreSQL database
 * via the Java backend APIs — see lib/javaApi.ts and the /api/* routes.
 *
 * This file retains only UI presentation helpers (colour maps, legends)
 * that are used by components like StatusPill.
 */

export type WaterLevel = 0 | 1 | 2 | 3;

/**
 * Project-wide severity vocabulary. The CRM standardises on:
 *   0 ft → Normal   (green)
 *   1 ft → Alert    (amber)
 *   2 ft → Warning  (orange)
 *   3 ft → Critical (red)
 *
 * This replaces the older "Safe / Warning Level 1 / Warning Level 2 / Danger"
 * naming. The new terms match the Alerts feed, the Dashboard chart legend,
 * and the Analytics legend for consistency across the whole CRM.
 */
export type NodeStatus = "Normal" | "Alert" | "Warning" | "Critical";
export type AlertType  = "CRITICAL" | "WARNING" | "NEW NODE" | "INACTIVE";

/** Derive human-readable status from a numeric water level. */
export const deriveStatusFromLevel = (level: WaterLevel): NodeStatus => {
  switch (level) {
    case 0:  return "Normal";
    case 1:  return "Alert";
    case 2:  return "Warning";
    default: return "Critical";
  }
};

/** Tailwind colour classes for each status — used by StatusPill and table rows. */
export const statusToneMap: Record<
  NodeStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  Normal: {
    bg: "bg-status-green/15",
    text: "text-status-green",
    border: "border-status-green/30",
    dot: "bg-status-green",
  },
  Alert: {
    bg: "bg-status-warning-1/20",
    text: "text-status-warning-1",
    border: "border-status-warning-1/30",
    dot: "bg-status-warning-1",
  },
  Warning: {
    bg: "bg-status-warning-2/20",
    text: "text-status-warning-2",
    border: "border-status-warning-2/40",
    dot: "bg-status-warning-2",
  },
  Critical: {
    bg: "bg-status-danger/15",
    text: "text-status-danger",
    border: "border-status-danger/30",
    dot: "bg-status-danger",
  },
};

/** Hex colour per status — used for chart fills and map markers.
 *  Aligned with lib/floodRiskMock.ts RISK_COLORS. */
export const statusHexMap: Record<NodeStatus, string> = {
  Normal:   "#22c55e",
  Alert:    "#f59e0b",
  Warning:  "#f97316",
  Critical: "#dc2626",
};

/** Legend entries for map and chart colour keys. */
export const statusLegend = [
  {
    label: "Normal" as NodeStatus,
    description: "Water Level 0",
    color: "bg-status-green/15 text-status-green",
    water_level: 0,
  },
  {
    label: "Alert" as NodeStatus,
    description: "Water Level 1 (1 ft)",
    color: "bg-status-warning-1/20 text-status-warning-1",
    water_level: 1,
  },
  {
    label: "Warning" as NodeStatus,
    description: "Water Level 2 (2 ft)",
    color: "bg-status-warning-2/20 text-status-warning-2",
    water_level: 2,
  },
  {
    label: "Critical" as NodeStatus,
    description: "Water Level 3 (3 ft)",
    color: "bg-status-danger/15 text-status-danger",
    water_level: 3,
  },
];
