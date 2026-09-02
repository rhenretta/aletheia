import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { traceLogger } from "@/core/observability/trace-logger";
import { postgresStore } from "@/core/storage/postgres-store";
import { verifyAdminAuth } from "@/core/auth/admin-guard";

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || "Unauthorized" }, { status: 401 });
  }

  const session = await getServerSession(authOptions);
  const defaultUserId = session?.user?.email
    ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
    : "usr_guest";

  const queryUserId = req.nextUrl.searchParams.get("userId") || defaultUserId;

  const traces = traceLogger.getRecentTraces(100);
  const memoryTraces = await postgresStore.getTraces(100);

  const combinedTraces = [...traces, ...memoryTraces].filter(
    (v, i, a) => a.findIndex((t) => t.trace_id === v.trace_id) === i
  );

  // Extract explicit AI & LLM calls
  const aiCalls = combinedTraces.map((t) => ({
    trace_id: t.trace_id,
    timestamp: t.timestamp,
    node: t.node_name,
    model: (t.metadata?.ai_provider as string) || "deepseek-chat",
    tokens_used: t.llm_tokens_used || 0,
    latency_ms: t.latency_ms,
    reasoning: t.reasoning_rationale,
    input: t.input_summary,
    output: t.output_summary,
    metadata: t.metadata || {},
  }));

  const allNodes = await postgresStore.getAllUnifiedTopicNodes();
  const targetNode =
    allNodes.find((n) => n.user_id === queryUserId) ||
    (await postgresStore.getUnifiedTopicNode(queryUserId));
  const userGraph = await postgresStore.getUserGraph(queryUserId);
  const facts = await postgresStore.getAllFacts();

  return NextResponse.json({
    success: true,
    postgres_connected: postgresStore.isPostgresConnected(),
    total_traces: combinedTraces.length,
    ai_calls: aiCalls,
    traces: combinedTraces,
    target_user_id: queryUserId,
    all_users: allNodes.map((n) => ({
      user_id: n.user_id,
      topics_count: Object.keys(n.topics || {}).length,
      topics: n.topics,
      last_updated: n.last_updated,
    })),
    database_state: {
      unified_topic_node: targetNode,
      user_graph: userGraph,
      facts_cached: facts.length,
    },
  });
}
