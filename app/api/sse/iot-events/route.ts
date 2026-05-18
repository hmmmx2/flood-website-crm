// GET /api/sse/iot-events?types=...&dataset=...
//
// Pipes the FloodWatch IoT SSE stream to the CRM browser. The browser's
// EventSource cannot add headers nor speak directly to the upstream
// (CORS is permissive but routing through the BFF keeps client logic
// trivial), so this route opens the upstream connection and forwards
// each event.
//
// PRIVACY NOTE (CRM-specific):
//   The community site strips `lat`/`lng`/`rssi`/`snr` from heartbeats
//   and drops `node_announce` entirely. The CRM is different:
//   operators NEED those diagnostic fields to run fleet health checks,
//   so the proxy here forwards every event verbatim. Geographic
//   coordinates are still subject to the privacy aggregator on the
//   /api/zones route — but the SSE channel itself is permissive.
//
// AUTH:
//   None on the IoT API itself. The CRM-side gate is the session
//   middleware on the rest of the app; an unauthenticated client
//   could technically open this stream, but they couldn't reach any
//   of the operator pages that consume it. Future hardening can
//   gate the SSE route via the same auth as the operator app.
//
// CRLF: The upstream is Starlette/Uvicorn (FastAPI) which emits SSE
// messages with CRLF separators (`\r\n\r\n`). The boundary detector
// below accepts both LF and CRLF so we don't lose events.

import { NextResponse } from "next/server";

import { buildStreamUrl } from "@/lib/floodwatch/api";
import type { Dataset } from "@/lib/floodwatch/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** SSE stays open until disconnect. Vercel caps by plan; 300s on Pro. */
export const maxDuration = 300;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseError(reason: string): NextResponse {
  const body = sseEvent("backend-unavailable", { reason });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "close",
    },
  });
}

/**
 * Locate the next SSE message boundary in `buffer` starting at `from`.
 * SSE spec allows either LF or CRLF line endings — Starlette/Uvicorn
 * (the FloodWatch IoT backend) uses CRLF. We accept both `\n\n` and
 * `\r\n\r\n` so the proxy works regardless of upstream framing.
 */
function findMessageBoundary(
  buffer: string,
  from = 0,
): { idx: number; sep: number } | null {
  const crlf = buffer.indexOf("\r\n\r\n", from);
  const lf = buffer.indexOf("\n\n", from);
  if (crlf === -1 && lf === -1) return null;
  if (crlf === -1) return { idx: lf, sep: 2 };
  if (lf === -1) return { idx: crlf, sep: 4 };
  return crlf <= lf ? { idx: crlf, sep: 4 } : { idx: lf, sep: 2 };
}

/**
 * Forward each upstream SSE message verbatim. No field stripping, no
 * event filtering — operators see everything. The only transform is
 * boundary detection so we emit one well-formed SSE message at a
 * time downstream (mirroring how the community proxy is structured,
 * which simplifies future privacy hardening if needed).
 */
function makeForwardTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let boundary: ReturnType<typeof findMessageBoundary>;
      while ((boundary = findMessageBoundary(buffer)) !== null) {
        const raw = buffer.slice(0, boundary.idx + boundary.sep);
        buffer = buffer.slice(boundary.idx + boundary.sep);
        controller.enqueue(encoder.encode(raw));
      }
    },
    flush(controller) {
      if (buffer.length > 0) controller.enqueue(encoder.encode(buffer));
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const types = url.searchParams.get("types") ?? undefined;
  const dataset = (url.searchParams.get("dataset") ?? undefined) as
    | Dataset
    | undefined;

  const upstreamUrl = buildStreamUrl({ types, dataset });

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error(
        "[api/sse/iot-events] upstream non-OK:",
        upstream.status,
        upstreamUrl,
        detail.slice(0, 400),
      );
      return sseError("upstream_error");
    }

    if (!upstream.body) {
      console.error("[api/sse/iot-events] missing response body:", upstreamUrl);
      return sseError("upstream_no_body");
    }

    const forwarded = upstream.body.pipeThrough(makeForwardTransform());

    return new NextResponse(forwarded, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[api/sse/iot-events] upstream fetch failed:", upstreamUrl, err);
    return sseError("upstream_unreachable");
  }
}
