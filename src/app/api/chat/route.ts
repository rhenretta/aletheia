import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/core/auth/auth-options";
import { DialogueAgent, ChatMessage } from "@/core/agents/intake/dialogue-agent";
import { postgresStore } from "@/core/storage/postgres-store";
import { AttachedStoryContext, UnifiedTopicNode } from "@/core/types/contracts";
import { ObserverAgent } from "@/core/agents/observer/observer-agent";
import { DiscoveryAgent } from "@/core/agents/discovery/discovery-agent";
import { executeAletheiaPipeline } from "@/core/graph/state-graph";

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

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const dialogueStream = DialogueAgent.chatStream(
            history || [],
            unifiedNode,
            attachedStory,
            currentStories,
            clientContext
          );

          let finalResponse: any = null;

          for await (const chunk of dialogueStream) {
            if (chunk.type === "token") {
              sendEvent("token", { token: chunk.token });
            } else if (chunk.type === "tool_start") {
              sendEvent("tool_start", { tool_name: chunk.tool_name, query: chunk.query });
            } else if (chunk.type === "tool_complete") {
              sendEvent("tool_complete", {
                tool_name: chunk.tool_name,
                query: chunk.query,
                summary: chunk.summary,
                sources: chunk.sources,
              });
            } else if (chunk.type === "meta") {
              finalResponse = chunk.data;
            }
          }

          if (finalResponse) {
            const fullHistory: ChatMessage[] = [
              ...history,
              {
                id: `bot_${Date.now()}`,
                role: "assistant" as const,
                content: finalResponse.message,
                timestamp: new Date().toISOString(),
                trace_id: finalResponse.trace_id,
                context_trace_id: finalResponse.context_trace_id,
                attached_story: attachedStory,
                tool_executions: finalResponse.tool_executions,
                agent_internal_rationale: finalResponse.agent_internal_rationale,
                context_generated: finalResponse.context_generated,
              },
            ];

            // 2. Invoke Observer Agent in background
            try {
              const observationResult = await ObserverAgent.observeAndAdapt(
                unifiedNode,
                fullHistory.map((m) => ({ role: m.role, content: m.content }))
              );
              unifiedNode = observationResult.adapted_node;
            } catch (err) {
              console.warn("Chat route: Observer adaptation failed:", err);
            }

            // 3. Ensure any validated extracted topics are merged into unifiedNode
            if (finalResponse.extracted_topics && finalResponse.extracted_topics.length > 0) {
              unifiedNode.topics = unifiedNode.topics || {};
              for (const t of finalResponse.extracted_topics) {
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

            // 4. Targeted Curator Signal & Dynamic Adaptive Feed Focus
            let filter = finalResponse.active_feed_filter;
            const contextGen = finalResponse.context_generated as any;
            const primaryTopic =
              filter?.topic ||
              contextGen?.identified_topic ||
              finalResponse.extracted_topics?.[0]?.topic;

            if (primaryTopic && (!filter || !filter.is_active || !filter.topic)) {
              const matchedIds = (contextGen?.relevant_stories || []).map((s: any) => s.event_id);
              filter = {
                is_active: true,
                topic: primaryTopic,
                matched_event_ids: matchedIds,
                filter_reason: `Adapted to active discussion on "${primaryTopic}"`,
                trigger_targeted_curation: matchedIds.length === 0,
                curation_query: primaryTopic,
              };
              finalResponse.active_feed_filter = filter;
            }

            const needsCuration =
              filter &&
              filter.is_active &&
              (filter.trigger_targeted_curation || !filter.matched_event_ids || filter.matched_event_ids.length === 0);

            if (needsCuration && filter.topic) {
              const queryTopic = filter.curation_query || filter.topic;
              finalResponse.active_feed_filter = {
                ...filter,
                is_active: true,
                trigger_targeted_curation: true,
                curation_query: queryTopic,
                filter_reason: `Curating live news stories for "${filter.topic}"...`,
              };
            }

            // 5. Persist chat session history
            await postgresStore.saveChatSession(
              effectiveUserId,
              fullHistory,
              finalResponse.extracted_topics || []
            );

            const userGraph = await postgresStore.getUserGraph(effectiveUserId);

            sendEvent("meta", {
              success: true,
              data: finalResponse,
              unified_topic_node: unifiedNode,
              user_graph: userGraph,
            });
          }

          sendEvent("done", {});
          controller.close();
        } catch (err: any) {
          sendEvent("error", { message: err?.message || "Streaming failed" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Chat intake failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

