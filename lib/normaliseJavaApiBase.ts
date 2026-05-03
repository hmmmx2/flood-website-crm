/**
 * Normalises the Spring / Kong base URL used by server-side `fetch` to Java.
 *
 * - Adds `https://` when the env value has no scheme (common for Vercel variables).
 * - Strips trailing slashes so `${base}${path}` never produces `//` before the path.
 *
 * **BFF vs Kong:** Next.js `/api/*` routes proxy to Java — that is the BFF. Kong sits
 * **behind** the BFF in Docker (`JAVA_API_URL=http://kong-gateway:8000/crm`). The
 * browser still talks to Next.js only; Kong is not a replacement for the BFF.
 * For Vercel + Railway, use the direct Spring base URL (no Kong in the path).
 */
export function normaliseJavaApiBase(
  raw: string | undefined,
  fallback: string,
): string {
  let u = (raw ?? "").trim() || fallback;
  if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
    u = `https://${u}`;
  }
  return u.replace(/\/+$/, "");
}
