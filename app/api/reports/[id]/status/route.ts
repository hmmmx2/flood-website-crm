// PATCH /api/reports/:id/status — update incident report status

import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
    const data = await javaFetch(`/reports/${id}/status`, { method: "PATCH", body, token });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/reports/:id/status PATCH]", error);
    return NextResponse.json({ error: "Failed to update report status" }, { status: 500 });
  }
}
