// /auth/callback - server-rendered SSO landing.
//
// Accepts only ?code=<opaque 32-byte URL-safe random>. The community login
// mints this code, stashes the token bundle in Upstash for 60 s, and redirects
// here. We redeem the code server-side, verify the JWT signature + role, set
// httpOnly cookies, and redirect to /dashboard. Tokens never appear in the URL.
//
// The legacy ?at=<token>&rt=<token>&u=<json> handoff is intentionally rejected
// because bearer tokens in URLs leak through browser history, logs, analytics,
// screenshots, and referrer headers.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
} from "@/lib/authCookies";
import { decodeJwtPayload, verifyJwtSignature } from "@/lib/jwtPayload";
import { isOperatorRole } from "@/lib/rbac";
import { redeemSsoCode } from "@/lib/sso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = {
  code?: string | string[];
};

function first(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0) return v[0];
  return null;
}

async function setAuthCookies(args: {
  accessToken: string;
  refreshToken: string;
  exp: number | null;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const accessMaxAge = Math.max(
    60,
    args.exp !== null ? args.exp - nowSec : 60 * 60,
  );
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, args.accessToken, authCookieOptions(accessMaxAge));
  jar.set(REFRESH_COOKIE, args.refreshToken, authCookieOptions(60 * 60 * 24 * 7));
}

async function verifyAndExtractRole(
  accessToken: string,
): Promise<
  | { ok: true; role: string | null; exp: number | null }
  | { ok: false; reason: "invalid" | "misconfigured" }
> {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    const verified = await verifyJwtSignature(accessToken, secret);
    if (!verified.ok) return { ok: false, reason: "invalid" };
    return {
      ok: true,
      role: typeof verified.payload.role === "string" ? verified.payload.role : null,
      exp: typeof verified.payload.exp === "number" ? verified.payload.exp : null,
    };
  }

  if (
    process.env.ALLOW_PAYLOAD_ONLY_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    const decoded = decodeJwtPayload(accessToken);
    if (!decoded) return { ok: false, reason: "invalid" };
    return {
      ok: true,
      role: typeof decoded.role === "string" ? decoded.role : null,
      exp: typeof decoded.exp === "number" ? decoded.exp : null,
    };
  }

  console.error(
    "[auth/callback] JWT_SECRET not set; refusing to set cookies. " +
      "Set JWT_SECRET on Vercel to match the Java backend secret.",
  );
  return { ok: false, reason: "misconfigured" };
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const code = first(params.code);

  if (!code) {
    redirect("/login?error=callback");
  }

  const payload = await redeemSsoCode(code);
  if (payload === null) {
    redirect("/login?error=sso_expired");
  }

  const verified = await verifyAndExtractRole(payload.accessToken);
  if (!verified.ok) {
    redirect(
      verified.reason === "misconfigured"
        ? "/login?error=misconfigured"
        : "/login?error=sso_failed",
    );
  }
  if (!isOperatorRole(verified.role)) {
    redirect("/login?error=role");
  }

  await setAuthCookies({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    exp: verified.exp,
  });
  redirect("/dashboard");
}
