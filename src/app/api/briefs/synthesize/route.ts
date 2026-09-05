import { NextRequest, NextResponse } from "next/server";
import { TopicBriefSynthesizer } from "@/core/matching/topic-brief-synthesizer";
import { postgresStore } from "@/core/storage/postgres-store";
import { SynthesizedEventCard, EventSourceArticle, UnifiedTopicNode } from "@/core/types/contracts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      topic,
      topic_id,
      cards = [],
      sources = [],
      previousDesign = null,
      userId = "usr_default",
    } = body as {
      topic: string;
      topic_id?: string;
      cards?: SynthesizedEventCard[];
      sources?: EventSourceArticle[];
      previousDesign?: any;
      userId?: string;
    };

    if (!topic) {
      return NextResponse.json({ success: false, error: "Missing required 'topic' parameter" }, { status: 400 });
    }

    // Retrieve topic meta for implicit depth/angles calibration (invisible steering)
    let depth = "practitioner";
    let curiosityVectors: string[] = [];
    try {
      const unifiedNode: UnifiedTopicNode = await postgresStore.getUnifiedTopicNode(userId);
      let meta = unifiedNode?.topics?.[topic];
      if (!meta && unifiedNode?.topics) {
        const cleanTopic = topic.toLowerCase().trim();
        for (const [k, v] of Object.entries(unifiedNode.topics)) {
          const cleanK = k.toLowerCase().trim();
          if (cleanK === cleanTopic || cleanK.includes(cleanTopic) || cleanTopic.includes(cleanK)) {
            meta = v;
            break;
          }
        }
      }
      if (meta) {
        depth = meta.technical_depth || "practitioner";
        curiosityVectors = meta.curiosity_vectors || [];
      }
    } catch (e) {
      // Non-blocking fallback
    }

    const evolutionResult = await TopicBriefSynthesizer.evolveBrief(
      topic,
      cards,
      sources,
      previousDesign,
      {
        technical_depth: depth,
        curiosity_vectors: curiosityVectors,
      },
      topic_id
    );

    return NextResponse.json({
      success: true,
      topic,
      topic_id: evolutionResult.topic_id || topic_id,
      decision: evolutionResult.decision,
      decision_rationale: evolutionResult.decision_rationale,
      design: evolutionResult.design,
      new_cards: evolutionResult.new_cards,
      all_sources: evolutionResult.all_sources,
      targeted_queries_executed: evolutionResult.targeted_queries_executed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Topic brief synthesis failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
