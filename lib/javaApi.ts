// ─────────────────────────────────────────────────────────────
// lib/javaApi.ts — Server-side proxy to Java Spring Boot API
//
// Used ONLY in Next.js API routes (server-side).
// Never import this in client components.
//
// Environment:
//   JAVA_API_URL  — CRM Spring Boot (`flood-service-crm`, default port 4002).
//                   Docker: http://crm-api:4002 (see flood-service-crm/docker-compose.yml)
//                   Local:  http://localhost:4002
// ─────────────────────────────────────────────────────────────

const JAVA_API_URL =
  process.env.JAVA_API_URL ||
  process.env.NEXT_PUBLIC_JAVA_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:4002";

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;          // Bearer token from the incoming CRM request
  revalidate?: number;     // Next.js ISR revalidation in seconds (default: 0)
};

export async function javaFetch<T>(
  path: string,
  { method = "GET", body, token, revalidate = 0 }: FetchOptions = {}
): Promise<T> {
  const url = `${JAVA_API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Next.js cache control
    next: { revalidate },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Java API ${method} ${path} → ${res.status}: ${text}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ── Typed helpers ──────────────────────────────────────────────

export type JavaSensorDto = {
  id: string;
  nodeId: string;
  name: string;
  status: "active" | "warning" | "inactive";
  distance: string;
  coordinate: [number, number];   // [longitude, latitude]
  area: string;
  location: string;
  state: string;
  currentLevel: 0 | 1 | 2 | 3;
  isDead: boolean;
  lastUpdated: string;
  createdAt: string;
};

export type JavaDashboardNode = {
  id: string;
  nodeId: string;
  name: string;
  area: string;
  level: string;
  status: "Normal" | "Watch" | "Warning" | "Critical" | "Offline";
  update: string;
  timestamp: string;
};
