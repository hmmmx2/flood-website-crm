// POST /api/auth/refresh
//
// Proxies the Java backend's `/auth/refresh` to mint a new access
// token. On success we ALSO rotate the httpOnly cookie so the
// Edge middleware keeps seeing a valid token without needing the
// client to re-write anything.

import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  authCookieOptions,
} from "@/lib/authCookies";
import { decodeJwtPayload } from "@/lib/jwtPayload";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { refreshToken?: string } = {};
  try {
    body = (await req.json()) as { refreshToken?: string };
  } catch {
    /* allow empty body — fall back to cookie below */
  }

  // Prefer the refresh token from the cookie (server-trusted) over
  // any client-supplied value in the body. The body path stays for
  // backwards-compat with the legacy AuthContext flow until that's
  // migrated entirely off localStorage.
  const refreshToken =
    req.cookies.get(REFRESH_COOKIE)?.value ?? body.refreshToken;
  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token available." },
      { status: 401 },
    );
  }

  let data: { accessToken: string };
  try {
    data = await javaFetch<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Token refresh failed" },
      { status },
    );
  }

  const res = NextResponse.json(data);

  // Rotate the access cookie. Java returns only a new access token —
  // refresh token lives unchanged in the existing cookie.
  if (data.accessToken) {
    const payload = decodeJwtPayload(data.accessToken);
    const exp = typeof payload?.exp === "number" ? payload.exp : 0;
    const remaining = Math.max(
      60,
      exp > 0 ? exp - Math.floor(Date.now() / 1000) : 60 * 60,
    );
    res.cookies.set(ACCESS_COOKIE, data.accessToken, authCookieOptions(remaining));
  }

  return res;
}
