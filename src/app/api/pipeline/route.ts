import { NextRequest, NextResponse } from "next/server";
import { executeAletheiaPipeline } from "@/core/graph/state-graph";
import { RawArticle, UserKnowledgeGraph, UnifiedTopicNode } from "@/core/types/contracts";
import { DiscoveryAgent } from "@/core/agents/discovery/discovery-agent";
import { postgresStore } from "@/core/storage/postgres-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { articles, topics, userGraph, userId, sessionId } = body as {
      articles?: RawArticle[];
      topics?: string[];
      userGraph?: UserKnowledgeGraph;
      userId?: string;
      sessionId?: string;
    };

    const effectiveUserId = userId || "usr_default";
    let articlesToProcess: RawArticle[] = articles || [];

    if (effectiveUserId && effectiveUserId !== "usr_guest" && effectiveUserId !== "usr_default") {
      const limitStatus = await postgresStore.checkUsageLimit(effectiveUserId);
      if (!limitStatus.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "MONTHLY_QUOTA_EXCEEDED",
            message: limitStatus.reason || "Monthly compute quota reached for pipeline execution. Upgrade to continue.",
            limitStatus,
          },
          { status: 402 }
        );
      }
    }

    const unifiedNode: UnifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
    const storedGraph = await postgresStore.getUserGraph(effectiveUserId);

    // Multi-Tier Topic Assembly via Discovery Agent (The Curator)
    if (!articlesToProcess || articlesToProcess.length === 0) {
      const discoveryResult = await DiscoveryAgent.curateAndCollect(unifiedNode, topics);
      articlesToProcess = discoveryResult.accepted_articles;
    }

    const result = await executeAletheiaPipeline({
      sessionId,
      userId: effectiveUserId,
      articles: articlesToProcess,
      userGraph: storedGraph || undefined,
      unifiedTopicNode: unifiedNode,
    });

    // Record pipeline run in usage metrics
    if (effectiveUserId && effectiveUserId !== "usr_guest") {
      await postgresStore.recordUsage(effectiveUserId, {
        pipelineRuns: 1,
        tokensUsed: 120,
        eventName: "pipeline",
        detail: `Curated ${result.feed_cards?.length || 0} stories across topics`,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      unified_topic_node: unifiedNode,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Pipeline execution failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

