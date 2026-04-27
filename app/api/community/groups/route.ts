import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

function extractToken(req: NextRequest) {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req);
    const data = await javaFetch<unknown>("/community/groups", { token });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    const body = await req.json();
    const data = await javaFetch<unknown>("/community/groups", { method: "POST", body, token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
