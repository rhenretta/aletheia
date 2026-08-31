import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";
import { DataPersistenceStore } from "@/core/storage/persistence";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const queryUserId = req.nextUrl.searchParams.get("userId");

  // Determine user ID:
  // 1. Authenticated session user
  // 2. Query param if explicitly provided for an authenticated user
  // 3. Guest / anonymous user (does NOT leak previous usr_default conversation)
  const isAuthenticated = !!session?.user?.email;
  const effectiveUserId = isAuthenticated
    ? `usr_${session!.user!.email!.replace(/[^a-zA-Z0-9]/g, "_")}`
    : queryUserId && queryUserId.startsWith("usr_") && queryUserId !== "usr_default"
    ? queryUserId
    : null;

  if (!effectiveUserId) {
    // Unauthenticated Guest: Return clean baseline topic node and empty conversation
    const guestNode = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_guest");
    const facts = await postgresStore.getAllFacts();

    return NextResponse.json({
      success: true,
      user_id: "usr_guest",
      is_authenticated: false,
      user: null,
      unified_topic_node: guestNode,
      user_graph: {
        user_id: "usr_guest",
        topic_weights: {},
        cognitive_load_state: "balanced",
        historical_anchors: [],
        dwell_history: [],
        last_updated: new Date().toISOString(),
      },
      messages: [],
      extracted_topics: [],
      facts_cached: facts,
    });
  }

  const unifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
  const userGraph = await postgresStore.getUserGraph(effectiveUserId);
  const chatSession = await postgresStore.getChatSession(effectiveUserId);
  const facts = await postgresStore.getAllFacts();

  return NextResponse.json({
    success: true,
    user_id: effectiveUserId,
    is_authenticated: true,
    user: session?.user || null,
    unified_topic_node: unifiedTopicNode || null,
    user_graph: userGraph || null,
    messages: chatSession?.messages || [],
    extracted_topics: chatSession?.extracted_topics || [],
    facts_cached: facts,
  });
}
