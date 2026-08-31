import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { DialogueAgent, ChatMessage } from "@/core/agents/intake/dialogue-agent";
import { postgresStore } from "@/core/storage/postgres-store";
import { AttachedStoryContext, UnifiedTopicNode } from "@/core/types/contracts";
import { ObserverAgent } from "@/core/agents/observer/observer-agent";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { history, userId, attachedStory, currentStories, clientContext } = body as {
      history: ChatMessage[];
      userId?: string;
      attachedStory?: AttachedStoryContext;
      currentStories?: Array<{
        event_id: string;
        headline: string;
        topic: string;
        summary: string;
      }>;
      clientContext?: {
        clientTime?: string;
        timeZone?: string;
        localFormatted?: string;
        location?: string;
      };
    };

    // Authenticated user session or explicit user ID
    const effectiveUserId =
      session?.user?.email
        ? `usr_${session.user.email.replace(/[^a-zA-Z0-9]/g, "_")}`
        : userId && userId.startsWith("usr_") && userId !== "usr_guest"
        ? userId
        : null;

    if (!effectiveUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required. Please sign in with Google to interact with the AI companion.",
        },
        { status: 401 }
      );
    }

    let unifiedNode: UnifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);

    // 1. Run dialogue interaction with Context Agent (The Empath) framing, active feed stories, and client context
    const response = await DialogueAgent.chat(
      history || [],
      unifiedNode,
      attachedStory,
      currentStories,
      clientContext
    );

    const fullHistory: ChatMessage[] = [
      ...history,
      {
        id: `bot_${Date.now()}`,
        role: "assistant" as const,
        content: response.message,
        timestamp: new Date().toISOString(),
        trace_id: response.trace_id,
        context_trace_id: response.context_trace_id,
        attached_story: attachedStory,
        tool_executions: response.tool_executions,
        agent_internal_rationale: response.agent_internal_rationale,
        context_generated: response.context_generated,
      },
    ];

    // 2. Invoke Observer Agent (The Active Listener) to silently adapt Unified Topic Node
    try {
      const observationResult = await ObserverAgent.observeAndAdapt(
        unifiedNode,
        fullHistory.map((m) => ({ role: m.role, content: m.content }))
      );
      unifiedNode = observationResult.adapted_node;
    } catch (err) {
      console.warn("Chat route: Observer adaptation failed:", err);
    }

    // 3. Ensure any validated extracted topics from DialogueAgent are permanently merged into unifiedNode
    if (response.extracted_topics && response.extracted_topics.length > 0) {
      unifiedNode.topics = unifiedNode.topics || {};
      for (const t of response.extracted_topics) {
        if (t.topic && typeof t.topic === "string") {
          const existing = unifiedNode.topics[t.topic];
          unifiedNode.topics[t.topic] = {
            weight: Number(Math.min(1.0, Math.max(0.2, (existing?.weight || t.weight || 0.6) + 0.05)).toFixed(2)),
            why_they_care: t.reasoning || existing?.why_they_care || "Expressed substantive interest during conversation.",
            technical_depth: existing?.technical_depth || "practitioner",
            curiosity_vectors: existing?.curiosity_vectors || [t.topic],
            last_discussed_at: new Date().toISOString(),
          };
        }
      }
      await postgresStore.saveUnifiedTopicNode(unifiedNode);
    }

    // 4. Persist chat session history and accumulated topics to PostgreSQL
    await postgresStore.saveChatSession(
      effectiveUserId,
      fullHistory,
      response.extracted_topics || []
    );

    const userGraph = await postgresStore.getUserGraph(effectiveUserId);

    return NextResponse.json({
      success: true,
      data: response,
      unified_topic_node: unifiedNode,
      user_graph: userGraph,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Chat intake failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

