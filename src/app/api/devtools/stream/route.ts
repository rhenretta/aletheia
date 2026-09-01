import { NextRequest } from "next/server";
import { traceLogger } from "@/core/observability/trace-logger";
import { AgentTraceLog } from "@/core/types/contracts";
import { verifyAdminAuth } from "@/core/auth/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return new Response(JSON.stringify({ error: auth.error || "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const initialPayload = JSON.stringify({
        type: "connected",
        timestamp: new Date().toISOString(),
        recent_traces: traceLogger.getRecentTraces(20),
      });
      controller.enqueue(encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`));

      // Subscribe to all live traces emitted by agents
      const unsubscribe = traceLogger.subscribe((trace: AgentTraceLog) => {
        try {
          const chunk = `event: trace\ndata: ${JSON.stringify(trace)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch (e) {
          // Stream closed or error
        }
      });

      // Keepalive heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Handle stream abort/disconnect
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
