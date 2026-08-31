import { NextResponse } from "next/server";
import { traceLogger } from "@/core/observability/trace-logger";
import { docWorker } from "@/core/observability/doc-worker";

export async function GET() {
  const traces = traceLogger.getRecentTraces(50);
  const mermaidGraph = docWorker.generateMermaidGraph();

  return NextResponse.json({
    success: true,
    traces,
    mermaidGraph,
  });
}
