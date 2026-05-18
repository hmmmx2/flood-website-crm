// POST /api/auth/session
//
// Sets the httpOnly auth cookies from a client-supplied token pair.
// This route exists because the /auth/callback page receives the
// access/refresh tokens via URL query params (from the community
// site's SSO redirect), and httpOnly cookies can ONLY be set by the
// server — the pre-hydration script can write localStorage but
// cannot create httpOnly cookies.
//
// The flow:
//   1. Community redirects to /auth/callback?at=...&rt=...&u=...
//   2. Pre-hydration script writes localStorage (legacy AuthContext)
//      AND validates role for the layered defence (H.5).
//   3. The client callback page effect POSTs the tokens here.
//   4. This route re-validates the role server-side (defence-in-depth)
//      and either sets cookies + returns 200 OR clears any stale
//      cookies + returns 403.
//
// The same shape is also useful if any future flow needs to set
// session cookies from a known-good token pair (e.g. impersonation
// in admin tooling).

import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
} from "@/lib/authCookies";
import { decodeJwtPayload } from "@/lib/jwtPayload";
import { isOperatorJwtRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type Body = {
  accessToken?: string;
  refreshToken?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const accessToken = body.accessToken;
  if (!accessToken || typeof accessToken !== "string") {
    return NextResponse.json(
      { error: "Missing access token." },
      { status: 400 },
    );
  }

  // ── Operator-class gate (server-side re-check) ────────────────
  const payload = decodeJwtPayload(accessToken);
  const role = typeof payload?.role === "string" ? payload.role : null;
  if (!isOperatorJwtRole(role)) {
    // Clear any stale cookies on rejection so a previous (operator)
    // session can't survive a Customer-token attempt.
    const res = NextResponse.json(
      {
        error:
          "This account is not authorised for CRM access. " +
          "Please use the community website for end-user features.",
      },
      { status: 403 },
    );
    res.cookies.delete(ACCESS_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  // Compute remaining lifetime from the JWT's `exp` claim, with a
  // floor of 1 minute (clock skew tolerance) and a soft default of
  // 1 hour if exp is missing.
  const exp = typeof payload?.exp === "number" ? payload.exp : 0;
  const remaining = Math.max(
    60,
    exp > 0 ? exp - Math.floor(Date.now() / 1000) : 60 * 60,
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, accessToken, authCookieOptions(remaining));
  if (body.refreshToken && typeof body.refreshToken === "string") {
    res.cookies.set(
      REFRESH_COOKIE,
      body.refreshToken,
      authCookieOptions(60 * 60 * 24 * 7),
    );
  }
  return res;
}
