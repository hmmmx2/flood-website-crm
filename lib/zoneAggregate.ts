/**
 * Server-side per-node anonymiser (CRM copy — mirrors community).
 *
 * Takes the raw IoT node list (already adapted to a uniform
 * `RawSensorRow`) and emits one map circle per node. Strips the
 * identifying fields the browser doesn't need and lightly fuzzes
 * the coordinate so an attacker reading the wire can't pinpoint
 * hardware to within centimetres.
 *
 * Privacy contract enforced here:
 *   1. Lat/lng on the wire are rounded to 4 decimal places (~11 m).
 *      Anyone with DevTools sees the circle's bucket, not the device's
 *      GPS reading.
 *   2. The original UUID and `node_id` never reach the browser as the
 *      `id` field. The output `id` is a stable FNV-1a hash.
 *   3. The original `name` field never reaches the browser.
 *   4. Rows with invalid or origin coordinates (lat≈0 and lng≈0) are
 *      dropped.
 *
 * `nodeId` IS forwarded so the CRM Devices side-panel can drill in
 * via the favourites / detail endpoints. The UI treats it as opaque.
 *
 * The function is pure so it's unit-testable; the BFF route in
 * `app/api/zones/route.ts` is the only caller in production.
 */

import type { FloodLevel, Zone } from "@/lib/types";

/**
 * Subset of the upstream sensor row shape this anonymiser needs. The
 * shape is kept loose so a future column on the upstream row doesn't
 * break us.
 */
export type RawSensorRow = {
  id?: string;
  nodeId?: string;
  name?: string | null;
  area?: string | null;
  location?: string | null;
  state?: string | null;
  latitude: number;
  longitude: number;
  currentLevel: FloodLevel;
  /** Server-side encoding — "inactive" means the radio went dark. */
  status?: "active" | "warning" | "critical" | "inactive";
  /** Some upstream responses use a boolean column instead of the status enum. */
  isDead?: boolean;
  lastUpdated?: string;
};

/** Fixed per-node circle radius. Small enough that adjacent nodes can
 *  still be distinguished, large enough to be tappable at zoom 11+. */
const NODE_RADIUS_M = 250;

/** Rounded to 4 d.p. (~11 m on the equator). Gives modest fuzz on the
 *  wire while still landing the circle in the right neighbourhood. */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Stable id derived from whatever the row gives us. Prefers the
 * server-generated UUID, falls back to `nodeId`, then to the rounded
 * coordinate. The returned value is always the FNV-1a hash — never
 * the original identifier — so the browser uses it as an opaque
 * React key.
 */
function stableNodeKey(r: RawSensorRow): string {
  const seed =
    r.id ?? r.nodeId ?? `${round4(r.latitude)},${round4(r.longitude)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return "n_" + (h >>> 0).toString(36);
}

/**
 * Map a row to its on-wire offline flag. Either `isDead === true` or
 * `status === "inactive"` flips the same downstream flag.
 */
function isOffline(r: RawSensorRow): boolean {
  if (r.isDead === true) return true;
  if (r.status === "inactive") return true;
  return false;
}

/**
 * Map raw rows to anonymised per-node `Zone`s. Pure function — no I/O,
 * no side effects, no globals.
 *
 * Emits ONE Zone per input row (no grouping). The "Zone" type
 * doubles as a single-node map circle.
 */
export function aggregateZones(rows: RawSensorRow[]): Zone[] {
  const out: Zone[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    if (Math.abs(r.latitude) < 0.001 && Math.abs(r.longitude) < 0.001) continue;

    const state = (r.state ?? "Unknown").trim() || "Unknown";
    const area = (r.area ?? r.location ?? "Unknown").trim() || "Unknown";
    const offline = isOffline(r);
    const level = (r.currentLevel ?? 0) as FloodLevel;

    out.push({
      id: stableNodeKey(r),
      // nodeId is forwarded for server-side drill-ins (favourites,
      // node-detail page). The UI never renders it as plaintext.
      nodeId: r.nodeId,
      // We surface area/state for filter chips — never the raw `name`
      // (which sometimes encodes the underlying node_id).
      name: area,
      state,
      area,
      centroidLat: round4(r.latitude),
      centroidLng: round4(r.longitude),
      radiusM: NODE_RADIUS_M,
      worstLevel: level,
      anyOffline: offline,
      allOffline: offline,
      sensorBand: "single",
      lastUpdated: r.lastUpdated,
    });
  }

  // Stable sort by id so consecutive polls render in the same order —
  // React reuses DOM nodes; Google Maps reuses Circle overlays.
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
