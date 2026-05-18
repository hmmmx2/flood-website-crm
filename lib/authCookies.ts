/**
 * Auth-cookie constants + options.
 *
 * Lives in its OWN file because the Edge runtime (middleware.ts) needs
 * the cookie name constants but MUST NOT pull in `javaFetch` /
 * `permissions.ts` / any module that touches Node-only APIs such as
 * `Buffer`. Importing the constants from a route handler triggers the
 * route's full import graph and breaks the Edge bundle.
 *
 * Keep this file dependency-free.
 */

/** httpOnly cookie holding the JWT access token. */
export const ACCESS_COOKIE = "flood_crm_access";

/** httpOnly cookie holding the long-lived refresh token. */
export const REFRESH_COOKIE = "flood_crm_refresh";

/**
 * Build the Set-Cookie attribute bag used for the auth cookies.
 *
 * - `httpOnly`  — JS can't read the cookie (defeats XSS)
 * - `sameSite: "lax"` — sends cookie on top-level GET navigation
 *                       (so the community → CRM SSO redirect works)
 *                       but blocks third-party AJAX
 * - `secure`    — HTTPS only in production (Vercel enforces HTTPS;
 *                 we can't set Secure in dev because localhost is
 *                 HTTP and Chrome would refuse to store the cookie)
 * - `path: "/"` — visible to every CRM route
 *
 * Vercel's CDN strips Set-Cookie from cached responses, so every
 * route that issues these cookies also exports `dynamic =
 * "force-dynamic"` and / or sends `Cache-Control: no-store`.
 */
export function authCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
