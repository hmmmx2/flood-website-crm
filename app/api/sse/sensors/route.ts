// GET /api/sse/sensors
// Pipes the Spring Boot SSE stream to the browser so the client never
// needs to know the backend URL or deal with CORS.
//
// LEGACY ROUTE NOTE (2026-05-18):
//   The /map page no longer consumes this stream — it subscribes to
//   `/api/sse/iot-events` (FloodWatch IoT API) via the IoTEventProvider
//   mounted in app/layout.tsx. This route stays in service for any
//   other CRM page that still wants the Java sensor stream. Migration
//   continues in a follow-up Phase 5 ticket.
//
// IMPORTANT: the live-sensor SSE endpoint is hosted on the COMMUNITY
// Java service, not the CRM service. The CRM's JAVA_API_URL points at
// flood-service-crm, so naively forwarding there would 404 → 502. We
// resolve the community service URL the same way the UAT survey BFF
// does: explicit COMMUNITY_JAVA_API_URL when set, otherwise the
// production community URL (never the CRM URL).

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function communityBase(): string {
  const explicit = process.env.COMMUNITY_JAVA_API_URL;
  if (explicit && explicit.length > 0) return explicit.replace(/\/$/, "");
  // JAVA_API_URL in this app points at flood-service-CRM (port 4002 locally,
  // crm Railway URL in prod) which does NOT host /sse/sensors — community
  // endpoints belong on flood-service-community. So fall back to the
  // production community URL rather than ricocheting requests at the CRM
  // service. For local dev set COMMUNITY_JAVA_API_URL=http://localhost:4001.
  return "https://flood-service-community-production.up.railway.app";
}

export async function GET() {
  try {
    const upstream = await fetch(`${communityBase()}/sse/sensors`, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return new NextResponse("SSE upstream unavailable", { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new NextResponse("SSE upstream unavailable", { status: 502 });
  }
}
