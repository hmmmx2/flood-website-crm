import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/change-password
 *
 * BFF proxy to Java POST /auth/change-password.
 * The caller must be authenticated (sends Bearer token in Authorization header).
 * Body: { currentPassword: string; newPassword: string }
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const body = await req.json();
    const data = await javaFetch<{ message: string }>("/auth/change-password", {
      method: "POST",
      body,
      token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Password change failed" },
      { status }
    );
  }
}
