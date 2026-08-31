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
  const chatSession = await postgresStore.getChatSession(effectiveUserId);

  // Reconcile and accumulate any extracted topics across sessions
  if (chatSession?.extracted_topics && chatSession.extracted_topics.length > 0) {
    unifiedTopicNode.topics = unifiedTopicNode.topics || {};
    let changed = false;
    for (const et of chatSession.extracted_topics) {
      if (et.topic && !unifiedTopicNode.topics[et.topic]) {
        unifiedTopicNode.topics[et.topic] = {
          weight: et.weight || 0.65,
          why_they_care: et.reasoning || "Derived from conversation history.",
          technical_depth: "practitioner",
          curiosity_vectors: [et.topic],
          last_discussed_at: new Date().toISOString(),
        };
        changed = true;
      }
    }
    if (changed) {
      await postgresStore.saveUnifiedTopicNode(unifiedTopicNode);
    }
  }

  const userGraph = await postgresStore.getUserGraph(effectiveUserId);
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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const queryUserId = req.nextUrl.searchParams.get("userId");

  const isAuthenticated = !!session?.user?.email;
  const effectiveUserId = isAuthenticated
    ? `usr_${session!.user!.email!.replace(/[^a-zA-Z0-9]/g, "_")}`
    : queryUserId && queryUserId.startsWith("usr_")
    ? queryUserId
    : "usr_guest";

  // Wipe user's persistent mind-state memory, chat session, and graph
  await postgresStore.clearSession(effectiveUserId);

  const cleanNode = DataPersistenceStore.createDefaultUnifiedTopicNode(effectiveUserId);
  const cleanGraph = {
    user_id: effectiveUserId,
    topic_weights: {},
    cognitive_load_state: "balanced" as const,
    historical_anchors: [],
    dwell_history: [],
    last_updated: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    message: "Profile and mind-state memory cleared successfully.",
    user_id: effectiveUserId,
    unified_topic_node: cleanNode,
    user_graph: cleanGraph,
    messages: [],
    extracted_topics: [],
  });
}
