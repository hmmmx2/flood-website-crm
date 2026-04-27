// GET /api/broadcasts  — list all broadcasts (cached 2 min)
// POST /api/broadcasts — send new broadcast (invalidates cache)

import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { withCache, invalidate, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

function getToken(req: NextRequest): string | undefined {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    const data = await withCache(
      "crm:broadcasts:all",
      CACHE_TTL.broadcasts,
      () => javaFetch("/broadcasts", { token })
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/broadcasts GET]", error);
    const status = (error as { status?: number }).status;
    return NextResponse.json(
      { error: "Failed to fetch broadcasts" },
      { status: status === 401 || status === 403 ? status : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await javaFetch("/broadcasts", {
      method: "POST",
      body,
      token: getToken(req),
    });
    // Invalidate cached list so next GET returns fresh data
    await invalidate("crm:broadcasts:all");
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("[/api/broadcasts POST]", error);
    const status = (error as { status?: number }).status;
    return NextResponse.json(
      { error: "Failed to send broadcast" },
      { status: status === 401 || status === 403 ? status : 500 }
    );
  }
}
