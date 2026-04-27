import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await javaFetch<unknown>(`/blogs/${params.id}`);
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const body = await req.json();
    const data = await javaFetch<unknown>(`/blogs/${params.id}`, { method: "PATCH" as any, body, token });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    await javaFetch<unknown>(`/blogs/${params.id}`, { method: "DELETE", token });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const url   = new URL(req.url);
    const action = url.pathname.endsWith("/featured") ? "featured" : "";
    const data = await javaFetch<unknown>(`/blogs/${params.id}${action ? `/${action}` : ""}`, {
      method: "PATCH",
      token,
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
