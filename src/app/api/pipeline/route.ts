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

    const unifiedNode: UnifiedTopicNode = await postgresStore.getUnifiedTopicNode(effectiveUserId);
    const storedGraph = userGraph || (await postgresStore.getUserGraph(effectiveUserId));

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

