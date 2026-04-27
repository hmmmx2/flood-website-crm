import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await javaFetch<unknown>("/auth/verify-reset-code", { method: "POST", body });
    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Verification failed";
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
