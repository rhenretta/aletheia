import { NextRequest, NextResponse } from "next/server";
import { traceLogger } from "@/core/observability/trace-logger";
import { verifyAdminAuth } from "@/core/auth/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const runId = searchParams.get("runId") || undefined;
  const q = searchParams.get("q") || undefined;
  const agent = searchParams.get("agent") || undefined;
  const callType = searchParams.get("type") || undefined;
  const flowLimit = parseInt(searchParams.get("flowLimit") || "30", 10);
  const limit = parseInt(searchParams.get("limit") || "60", 10);

  const flows = traceLogger.getRecentFlows(flowLimit);
  const traces = traceLogger.searchTraces({
    q,
    agent,
    callType,
    runId,
    limit,
  });

  const totalTokens = traces.reduce((acc, t) => acc + (t.llm_tokens_used || 0), 0);
  const avgLatency =
    traces.length > 0
      ? Math.round(traces.reduce((acc, t) => acc + (t.latency_ms || 0), 0) / traces.length)
      : 0;

  return NextResponse.json({
    success: true,
    total_flows: flows.length,
    total_traces: traces.length,
    stats: {
      total_tokens: totalTokens,
      avg_latency_ms: avgLatency,
      flow_count: flows.length,
    },
    flows,
    traces,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || "Unauthorized" }, { status: 401 });
  }

  traceLogger.clearTraces();
  return NextResponse.json({ success: true, message: "Traces cleared successfully." });
}
