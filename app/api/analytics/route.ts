import { NextRequest, NextResponse } from "next/server";
import { javaFetch } from "@/lib/javaApi";
import { withCache, CACHE_TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getToken(req: NextRequest): string | undefined {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? undefined;
}

export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);

    // Cache analytics summary per token (admin-scoped) for 5 min
    const cacheKey = `crm:analytics:${token?.slice(-8) ?? "anon"}`;

    const data = await withCache(cacheKey, CACHE_TTL.analytics, () =>
      javaFetch("/analytics", { token })
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("[/api/analytics GET]", error);
    const status = (error as { status?: number }).status;
    const httpStatus = status === 401 || status === 403 ? status : 500;
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: httpStatus });
  }
}
