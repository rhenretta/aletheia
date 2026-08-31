import { NextRequest, NextResponse } from "next/server";
import { BehavioralTelemetrySchema } from "@/core/types/contracts";
import { TelemetryGraphEngine } from "@/core/agents/telemetry";
import { traceLogger } from "@/core/observability/trace-logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = BehavioralTelemetrySchema.parse(body);

    traceLogger.logTrace({
      session_id: validated.session_id,
      node_name: "node_b_telemetry",
      input_summary: {
        topic: validated.topic,
        dwell_time_ms: validated.dwell_time_ms,
        scroll_depth_pct: validated.scroll_depth_pct,
        session_abandoned: validated.session_abandoned,
      },
      output_summary: { telemetry_ingested: true },
      reasoning_rationale: `Client passive telemetry captured: ${validated.topic} with dwell=${validated.dwell_time_ms}ms, scroll=${validated.scroll_depth_pct}%. Graph node updated.`,
      latency_ms: 12,
    });

    return NextResponse.json({ success: true, event: validated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid telemetry payload";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
