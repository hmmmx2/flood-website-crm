import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

function extractToken(req: NextRequest): string | undefined {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = extractToken(req);
    await javaFetch<void>(`/community/posts/${id}`, { method: "DELETE", token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
