import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function extractToken(req: NextRequest): string | undefined {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req);
    const users = await javaFetch<unknown[]>("/admin/users", { token });
    return NextResponse.json(users);
  } catch (error) {
    const status = error instanceof Error && error.message.includes("403") ? 403 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req);
    const body = await req.json();
    const user = await javaFetch<unknown>("/admin/users", { method: "POST", body, token });
    return NextResponse.json(user);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to create user";
    const status = msg.includes("409") || msg.toLowerCase().includes("already exists") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
