import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { postgresStore } from "@/core/storage/postgres-store";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const queryUserId = req.nextUrl.searchParams.get("userId");

  const effectiveUserId =
    queryUserId ||
    (session?.user?.email ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}` : "usr_default");

  const unifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
  const userGraph = await postgresStore.getUserGraph(effectiveUserId);
  const chatSession = await postgresStore.getChatSession(effectiveUserId);
  const facts = await postgresStore.getAllFacts();

  return NextResponse.json({
    success: true,
    user_id: effectiveUserId,
    is_authenticated: !!session?.user,
    user: session?.user || null,
    unified_topic_node: unifiedTopicNode || null,
    user_graph: userGraph || null,
    messages: chatSession?.messages || [],
    extracted_topics: chatSession?.extracted_topics || [],
    facts_cached: facts,
  });
}
