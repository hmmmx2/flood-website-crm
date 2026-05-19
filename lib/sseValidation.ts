// QA P1-7 — Runtime validation for SSE payloads coming from the
// community Java backend's `/sse/sensors` stream.
//
// The three CRM pages that listen to this stream (`/dashboard`,
// `/sensors`, `/alerts`) all used to do a bare `JSON.parse(e.data) as
// SseSensorDto` and trust whatever fell out. A bad upstream (mid-deploy
// schema drift, MITM, manual `curl` test from someone's laptop) would
// silently corrupt React state — `currentLevel: 999` colours a marker
// off the severity palette, `latitude: "x"` breaks the Google Maps
// pin, `isDead: "true"` (string) flips truthiness incorrectly.
//
// `validateSseSensorDto` returns the parsed DTO on success or `null`
// on any structural issue. Callers log a warning and skip the update
// rather than throwing — the SSE stream should keep running even when
// one event is malformed.

export type SseSensorDto = {
  id: string;
  nodeId: string;
  name?: string;
  area: string;
  location: string;
  state: string;
  latitude: number;
  longitude: number;
  currentLevel: 0 | 1 | 2 | 3;
  status: "active" | "warning" | "critical" | "inactive";
  isDead?: boolean;
  lastUpdated: string;
};

const VALID_STATUSES = new Set(["active", "warning", "critical", "inactive"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Validate a raw event payload and return a typed DTO, or null if any
 * required field is missing / wrong type / out of range. Logs the
 * rejection in dev so it's catchable during integration testing.
 */
export function validateSseSensorDto(raw: unknown): SseSensorDto | null {
  if (!raw || typeof raw !== "object") return reject("not_object", raw);
  const o = raw as Record<string, unknown>;

  // Identity + location names
  if (!isNonEmptyString(o.id)) return reject("id", o);
  if (!isNonEmptyString(o.nodeId)) return reject("nodeId", o);
  if (!isNonEmptyString(o.area)) return reject("area", o);
  if (!isNonEmptyString(o.location)) return reject("location", o);
  if (!isNonEmptyString(o.state)) return reject("state", o);
  if (!isNonEmptyString(o.lastUpdated)) return reject("lastUpdated", o);

  // Coordinates — must be within valid lat/lng ranges
  if (!isFiniteNumber(o.latitude) || o.latitude < -90 || o.latitude > 90) {
    return reject("latitude", o);
  }
  if (!isFiniteNumber(o.longitude) || o.longitude < -180 || o.longitude > 180) {
    return reject("longitude", o);
  }

  // Water level — discrete 0..3 ordinal
  if (
    !isFiniteNumber(o.currentLevel) ||
    !Number.isInteger(o.currentLevel) ||
    (o.currentLevel as number) < 0 ||
    (o.currentLevel as number) > 3
  ) {
    return reject("currentLevel", o);
  }

  // Status — closed enum
  if (typeof o.status !== "string" || !VALID_STATUSES.has(o.status)) {
    return reject("status", o);
  }

  // Optional fields
  if (o.name !== undefined && typeof o.name !== "string") {
    return reject("name_type", o);
  }
  if (o.isDead !== undefined && typeof o.isDead !== "boolean") {
    return reject("isDead_type", o);
  }

  return o as unknown as SseSensorDto;
}

function reject(reason: string, raw: unknown): null {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(`[sse] rejected sensor-update event: ${reason}`, raw);
  }
  return null;
}
