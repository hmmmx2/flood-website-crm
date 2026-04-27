// GET /api/zones — list all flood risk zones

import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

function getToken(req: NextRequest): string | undefined {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function GET(req: NextRequest) {
  try {
    const data = await javaFetch("/zones", { token: getToken(req) });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/zones GET]", error);
    return NextResponse.json({ error: "Failed to fetch zones" }, { status: 500 });
  }
}
