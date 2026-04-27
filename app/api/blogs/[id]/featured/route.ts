import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const data = await javaFetch<unknown>(`/blogs/${params.id}/featured`, { method: "PATCH", token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
