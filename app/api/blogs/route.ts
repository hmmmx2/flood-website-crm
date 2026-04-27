import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page     = searchParams.get("page")     ?? "0";
    const size     = searchParams.get("size")     ?? "50";
    const category = searchParams.get("category") ?? "";
    const catParam = category ? `&category=${encodeURIComponent(category)}` : "";
    const data = await javaFetch<unknown>(`/blogs?page=${page}&size=${size}${catParam}`);
    return NextResponse.json(data);
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const body = await req.json();
    const data = await javaFetch<unknown>("/blogs", { method: "POST", body, token });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status });
  }
}
