// GET /api/reports — list all incident reports (CRM review)

import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
    const data = await javaFetch("/reports", { token });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/reports GET]", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}
