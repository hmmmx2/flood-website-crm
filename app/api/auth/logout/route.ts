// POST /api/auth/logout
//
// Clears the httpOnly auth cookies. Called by the client AuthContext
// `logout()` helper after it wipes localStorage. Without this round
// trip, the cookies would linger and the middleware would let the
// next request through; the localStorage wipe alone would only
// confuse the client UI.
//
// We also try a best-effort POST to the Java backend's `/auth/logout`
// so any refresh token is revoked server-side. A 4xx from Java is
// fine — the cookies still get cleared.

import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/authCookies";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Best-effort: tell Java to revoke. Don't fail if it errors.
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      await javaFetch<unknown>("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      }).catch(() => {
        /* Java offline / 4xx — proceed with cookie wipe */
      });
    }
  } catch {
    /* never let a Java failure block local cookie wipe */
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
