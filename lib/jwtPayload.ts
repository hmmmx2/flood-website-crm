/**
 * Server-side JWT payload decoder + signature verification.
 *
 * Two functions of interest:
 *
 *   1. `decodeJwtPayload(token)` — base64-decodes the payload section
 *      WITHOUT verifying the signature. Cheap; runs everywhere
 *      (Node + Edge); useful for reading claims like `exp` and `role`
 *      on tokens we already trust.
 *
 *   2. `verifyJwtSignature(token, secret)` — cryptographically
 *      verifies the JWT's HS256 signature against the shared HMAC
 *      secret. Returns the payload on success, `null` on any failure
 *      (bad signature, malformed token, expired, etc.). Uses the
 *      `jose` library which is Edge-runtime compatible.
 *
 * The middleware uses (2) when `JWT_SECRET` is configured in the
 * environment, falling back to (1) when it isn't (e.g. during the
 * migration window before Ops adds the secret to Vercel). Either
 * way, Java's auth filter is the final wall — a forged token will
 * always fail at the first server call that requires authorisation.
 *
 * Callers:
 *   • `app/api/auth/login/route.ts` — checks `role` claim before
 *     forwarding tokens to the browser.
 *   • `middleware.ts` — verifies signature (when secret available)
 *     then checks `role` + `exp` on the access-token cookie.
 *   • `app/auth/callback/page.tsx` + `app/api/auth/session/route.ts`
 *     — gate the community SSO handoff on `role`.
 */

import { jwtVerify, errors as joseErrors } from "jose";

export type JwtPayload = {
  sub?: string;
  role?: string;
  email?: string;
  /** Expiry, seconds since epoch. */
  exp?: number;
  /** Issued at, seconds since epoch. */
  iat?: number;
  [key: string]: unknown;
};

/**
 * Decode the base64url-encoded payload section of a JWT. Returns
 * `null` for any malformed input — never throws.
 */
export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    // Buffer is available in Node.js runtime; in middleware on the
    // edge runtime we use `atob` for the same effect.
    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(padded, "base64").toString("utf-8")
        : atob(padded);
    const obj = JSON.parse(decoded);
    return obj && typeof obj === "object" ? (obj as JwtPayload) : null;
  } catch {
    return null;
  }
}

/**
 * Number of milliseconds remaining until the token's `exp` claim
 * elapses. Negative if already expired; `null` if no `exp` present
 * or the token is malformed.
 */
export function msUntilExpiry(token: string | null | undefined): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000 - Date.now();
}

/**
 * Quick predicate: is this token at least nominally valid (decodes
 * cleanly + has a future `exp`). The Java backend's signature check
 * is the wall against forgery; this is purely about basic structure.
 */
export function isTokenStructurallyValid(token: string | null | undefined): boolean {
  const ms = msUntilExpiry(token);
  return ms !== null && ms > 0;
}

/**
 * Result of `verifyJwtSignature`. Discriminated so callers can
 * branch on `ok` and get either the verified payload or a tagged
 * failure reason.
 */
export type VerifyResult =
  | { ok: true; payload: JwtPayload }
  | { ok: false; reason: "no-secret" | "invalid-signature" | "expired" | "malformed" | "other" };

/**
 * Cryptographically verify a JWT's HS256 signature against the shared
 * HMAC secret. Returns the verified payload on success, or a tagged
 * failure reason. Never throws — caller branches on `result.ok`.
 *
 * @param token   The JWT, in compact serialisation (`header.payload.sig`).
 * @param secret  The HMAC secret. Must match the `JWT_SECRET` env var
 *                on the Java backend that minted this token. Pass an
 *                empty / missing value to disable verification (returns
 *                `{ ok: false, reason: "no-secret" }` — caller decides
 *                whether to fall back to payload-only validation).
 *
 * Edge-runtime compatible: `jose` is built for it; no Node-only APIs
 * are used. The middleware can call this directly.
 */
export async function verifyJwtSignature(
  token: string | null | undefined,
  secret: string | null | undefined,
): Promise<VerifyResult> {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (!secret) {
    return { ok: false, reason: "no-secret" };
  }
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return { ok: true, payload: payload as JwtPayload };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    if (
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWSInvalid ||
      err instanceof joseErrors.JWTInvalid
    ) {
      return { ok: false, reason: "invalid-signature" };
    }
    return { ok: false, reason: "other" };
  }
}
