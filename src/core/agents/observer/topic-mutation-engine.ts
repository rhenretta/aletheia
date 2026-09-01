import {
  UnifiedTopicNode,
  TechnicalDepth,
  TopicMetadata,
  TopicUpdateDiff,
  HarmonizationAction,
} from "../../types/contracts";

export interface CreateTopicParams {
  topic: string;
  weight?: number;
  what_they_care_about?: string;
  why_they_care: string;
  presentation_strategy?: string;
  technical_depth?: TechnicalDepth;
  living_narrative?: string;
  likes_and_angles?: string[];
  dislikes_and_critiques?: string[];
  curiosity_vectors?: string[];
  evolution_insight?: string;
  evidence?: string;
}

export interface UpdateTopicParams {
  topic: string;
  weight_delta?: number;
  what_they_care_about?: string;
  why_they_care?: string;
  presentation_strategy?: string;
  technical_depth?: TechnicalDepth;
  living_narrative?: string;
  likes_and_angles?: string[];
  dislikes_and_critiques?: string[];
  curiosity_vectors_to_add?: string[];
  curiosity_vectors_to_remove?: string[];
  evolution_insight?: string;
  evidence?: string;
}

export interface MergeTopicsParams {
  source_topics: string[];
  resulting_topic: string;
  weight?: number;
  what_they_care_about?: string;
  why_they_care?: string;
  presentation_strategy?: string;
  technical_depth?: TechnicalDepth;
  curiosity_vectors?: string[];
  rationale: string;
}

export interface SplitTopicParams {
  source_topic: string;
  resulting_topics: Array<{
    topic: string;
    weight: number;
    what_they_care_about?: string;
    why_they_care: string;
    presentation_strategy?: string;
    technical_depth?: TechnicalDepth;
    curiosity_vectors?: string[];
  }>;
  rationale: string;
}

export interface DeleteTopicParams {
  topic: string;
  rationale: string;
}

export type TopicMutationToolCall =
  | { tool: "create_topic"; parameters: CreateTopicParams }
  | { tool: "update_topic"; parameters: UpdateTopicParams }
  | { tool: "merge_topics"; parameters: MergeTopicsParams }
  | { tool: "split_topic"; parameters: SplitTopicParams }
  | { tool: "delete_topic"; parameters: DeleteTopicParams };

export function cleanLivingMotivation(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  clean = clean.replace(/^User (?:explicitly |directly |recently )?(?:mentioned|stated|expressed|asked about|discussed|brought up|noted)\s+(?:interest in\s+)?/i, "Focuses on ");
  clean = clean.replace(/\s+in prior turns and this turn's summary highlights them as a key trend\.?/i, ".");
  clean = clean.replace(/\s+in prior turns\.?/i, ".");
  clean = clean.replace(/; relevant to [a-zA-Z\s]+ discussion\.?/i, ".");
  return clean.trim();
}

export class TopicMutationEngine {
  /**
   * Creates a new topic node in the user's knowledge graph.
   * If the topic already exists, seamlessly converts to an update operation.
   */
  public static executeCreateTopic(
    node: UnifiedTopicNode,
    params: CreateTopicParams,
    triggerSource: "observer_agent" | "dialogue_agent" | "interest_harmonizer" = "observer_agent"
  ): { changed: boolean; diff?: TopicUpdateDiff } {
    if (!params.topic || typeof params.topic !== "string") {
      return { changed: false };
    }

    const topicName = params.topic.trim();
    if (!topicName) return { changed: false };

    node.topics = node.topics || {};
    const timestamp = new Date().toISOString();

    if (node.topics[topicName]) {
      // Convert to update if already exists
      return this.executeUpdateTopic(
        node,
        {
          topic: topicName,
          weight_delta: 0.1,
          what_they_care_about: params.what_they_care_about,
          why_they_care: params.why_they_care,
          presentation_strategy: params.presentation_strategy,
          technical_depth: params.technical_depth,
          curiosity_vectors_to_add: params.curiosity_vectors,
          evidence: params.evidence,
        },
        triggerSource
      );
    }

    const validDepth: TechnicalDepth = ["introductory", "practitioner", "expert", "deep_technical"].includes(
      params.technical_depth || "practitioner"
    )
      ? params.technical_depth!
      : "practitioner";

    const initialWeight = Number(Math.min(1.0, Math.max(0.1, params.weight || 0.6)).toFixed(2));
    const curiosityVectors = Array.isArray(params.curiosity_vectors) && params.curiosity_vectors.length > 0
      ? params.curiosity_vectors
      : [topicName];

    const cleanedWhy = cleanLivingMotivation(params.why_they_care) || `Substantive intellectual focus on ${topicName}.`;

    const newMetadata: TopicMetadata = {
      weight: initialWeight,
      what_they_care_about: params.what_they_care_about || params.living_narrative || undefined,
      why_they_care: cleanedWhy,
      presentation_strategy: params.presentation_strategy || undefined,
      technical_depth: validDepth,
      living_narrative: params.living_narrative || cleanedWhy,
      likes_and_angles: params.likes_and_angles || [],
      dislikes_and_critiques: params.dislikes_and_critiques || [],
      curiosity_vectors: curiosityVectors,
      evolution_timeline: [
        {
          timestamp,
          insight: params.evolution_insight || cleanedWhy,
          trigger_source: triggerSource,
          evidence: params.evidence,
        },
      ],
      last_discussed_at: timestamp,
    };

    node.topics[topicName] = newMetadata;
    node.last_updated = timestamp;

    const diff: TopicUpdateDiff = {
      topic_name: topicName,
      timestamp,
      trigger_source: triggerSource,
      reasoning: params.why_they_care || `Discovered new interest in ${topicName}.`,
      evidence: params.evidence,
      previous_state: {
        weight: 0,
        technical_depth: validDepth,
        why_they_care: "Unmapped topic.",
        curiosity_vectors: [],
      },
      current_state: {
        weight: initialWeight,
        technical_depth: validDepth,
        why_they_care: newMetadata.why_they_care,
        curiosity_vectors: curiosityVectors,
      },
      weight_delta: initialWeight,
      depth_changed: true,
      why_changed: true,
      vectors_added: curiosityVectors,
    };

    node.recent_topic_diffs = [diff, ...(node.recent_topic_diffs || []).slice(0, 30)];

    return { changed: true, diff };
  }

  /**
   * Selectively updates an existing topic node without touching other nodes.
   */
  public static executeUpdateTopic(
    node: UnifiedTopicNode,
    params: UpdateTopicParams,
    triggerSource: "observer_agent" | "dialogue_agent" | "interest_harmonizer" = "observer_agent"
  ): { changed: boolean; diff?: TopicUpdateDiff } {
    if (!params.topic || typeof params.topic !== "string") {
      return { changed: false };
    }

    const topicName = params.topic.trim();
    node.topics = node.topics || {};

    const existing = node.topics[topicName];
    if (!existing) {
      // If topic does not exist, route to create
      return this.executeCreateTopic(
        node,
        {
          topic: topicName,
          weight: Math.max(0.2, (params.weight_delta || 0.1) + 0.5),
          why_they_care: params.why_they_care || `Interest in ${topicName}.`,
          technical_depth: params.technical_depth || "practitioner",
          living_narrative: params.living_narrative,
          likes_and_angles: params.likes_and_angles,
          dislikes_and_critiques: params.dislikes_and_critiques,
          curiosity_vectors: params.curiosity_vectors_to_add || [topicName],
          evolution_insight: params.evolution_insight,
          evidence: params.evidence,
        },
        triggerSource
      );
    }

    const timestamp = new Date().toISOString();
    const prevWeight = existing.weight;
    const prevDepth = existing.technical_depth;
    const prevWhy = existing.why_they_care;
    const prevVectors = existing.curiosity_vectors || [];

    const newWeight = Number(Math.min(1.0, Math.max(0.1, prevWeight + (params.weight_delta || 0.05))).toFixed(2));
    const validDepth: TechnicalDepth = params.technical_depth &&
      ["introductory", "practitioner", "expert", "deep_technical"].includes(params.technical_depth)
        ? params.technical_depth
        : prevDepth;

    const newWhy = cleanLivingMotivation(params.why_they_care || prevWhy) || prevWhy;

    // Merge Living Narrative
    let updatedNarrative = existing.living_narrative || existing.why_they_care;
    if (params.living_narrative) {
      updatedNarrative = cleanLivingMotivation(params.living_narrative);
    } else if (params.why_they_care && !updatedNarrative.includes(newWhy)) {
      updatedNarrative = `${updatedNarrative} ${newWhy}`.trim();
    }

    const newWhat = params.what_they_care_about || existing.what_they_care_about || updatedNarrative || undefined;
    const newPresentation = params.presentation_strategy || existing.presentation_strategy || undefined;

    let newVectors = [...prevVectors];
    if (params.curiosity_vectors_to_add) {
      for (const v of params.curiosity_vectors_to_add) {
        if (!newVectors.includes(v)) newVectors.push(v);
      }
    }
    if (params.curiosity_vectors_to_remove) {
      newVectors = newVectors.filter((v) => !params.curiosity_vectors_to_remove?.includes(v));
    }

    // Merge Likes & Angles
    const mergedLikes = new Set(existing.likes_and_angles || []);
    if (params.likes_and_angles) {
      params.likes_and_angles.forEach((l) => mergedLikes.add(l));
    }

    // Merge Dislikes & Critiques
    const mergedDislikes = new Set(existing.dislikes_and_critiques || []);
    if (params.dislikes_and_critiques) {
      params.dislikes_and_critiques.forEach((d) => mergedDislikes.add(d));
    }

    // Append to Evolution Timeline
    const timeline = [...(existing.evolution_timeline || [])];
    const newInsight = params.evolution_insight || (params.why_they_care && params.why_they_care !== prevWhy ? newWhy : undefined) || (params.evidence ? `Expressed: "${params.evidence.slice(0, 80)}"` : undefined);
    if (newInsight && !timeline.some((t) => t.insight === newInsight)) {
      timeline.push({
        timestamp,
        insight: newInsight,
        trigger_source: triggerSource,
        evidence: params.evidence,
      });
    }

    node.topics[topicName] = {
      weight: newWeight,
      what_they_care_about: newWhat,
      why_they_care: newWhy,
      presentation_strategy: newPresentation,
      technical_depth: validDepth,
      living_narrative: updatedNarrative,
      likes_and_angles: Array.from(mergedLikes),
      dislikes_and_critiques: Array.from(mergedDislikes),
      curiosity_vectors: newVectors,
      evolution_timeline: timeline.slice(-20),
      last_discussed_at: timestamp,
    };
    node.last_updated = timestamp;

    const diff: TopicUpdateDiff = {
      topic_name: topicName,
      timestamp,
      trigger_source: triggerSource,
      reasoning: params.why_they_care || `Deepened interest in ${topicName}.`,
      evidence: params.evidence,
      previous_state: {
        weight: prevWeight,
        technical_depth: prevDepth,
        why_they_care: prevWhy,
        curiosity_vectors: prevVectors,
      },
      current_state: {
        weight: newWeight,
        technical_depth: validDepth,
        why_they_care: newWhy,
        curiosity_vectors: newVectors,
      },
      weight_delta: Number((newWeight - prevWeight).toFixed(2)),
      depth_changed: prevDepth !== validDepth,
      why_changed: prevWhy !== newWhy,
      vectors_added: newVectors.filter((v) => !prevVectors.includes(v)),
      vectors_removed: prevVectors.filter((v) => !newVectors.includes(v)),
    };

    node.recent_topic_diffs = [diff, ...(node.recent_topic_diffs || []).slice(0, 30)];

    return { changed: true, diff };
  }

  /**
   * Merges two or more overlapping/duplicate topics into a single canonical topic.
   */
  public static executeMergeTopics(
    node: UnifiedTopicNode,
    params: MergeTopicsParams
  ): { changed: boolean; diffs: TopicUpdateDiff[]; action?: HarmonizationAction } {
    node.topics = node.topics || {};
    const sources = (params.source_topics || []).filter((s) => node.topics[s]);
    if (sources.length === 0) return { changed: false, diffs: [] };

    const targetName = params.resulting_topic.trim();
    if (!targetName) return { changed: false, diffs: [] };

    const timestamp = new Date().toISOString();
    const beforeState: Record<string, TopicMetadata> = {};
    const allVectors: string[] = params.curiosity_vectors ? [...params.curiosity_vectors] : [];
    let maxWeight = 0.5;
    const whySnippets: string[] = [];

    for (const src of sources) {
      const meta = node.topics[src];
      beforeState[src] = { ...meta };
      maxWeight = Math.max(maxWeight, meta.weight);
      (meta.curiosity_vectors || []).forEach((v) => {
        if (!allVectors.includes(v)) allVectors.push(v);
      });
      if (meta.why_they_care) whySnippets.push(meta.why_they_care);
      delete node.topics[src];
    }

    const validDepth: TechnicalDepth = params.technical_depth &&
      ["introductory", "practitioner", "expert", "deep_technical"].includes(params.technical_depth)
        ? params.technical_depth
        : beforeState[sources[0]]?.technical_depth || "practitioner";

    const targetWeight = Number(Math.min(1.0, params.weight || maxWeight + 0.05).toFixed(2));
    const targetWhy = params.why_they_care || whySnippets.join(" ") || `Consolidated interest.`;

    const newTargetMetadata: TopicMetadata = {
      weight: targetWeight,
      why_they_care: targetWhy,
      technical_depth: validDepth,
      curiosity_vectors: allVectors.length > 0 ? allVectors : [targetName],
      last_discussed_at: timestamp,
    };

    node.topics[targetName] = newTargetMetadata;
    node.last_updated = timestamp;

    const diffs: TopicUpdateDiff[] = [];
    for (const src of sources) {
      const prev = beforeState[src];
      const diff: TopicUpdateDiff = {
        topic_name: src,
        timestamp,
        trigger_source: "interest_harmonizer",
        reasoning: params.rationale || `Merged into "${targetName}".`,
        evidence: `MERGE: ${sources.join(", ")} -> ${targetName}`,
        previous_state: {
          weight: prev.weight,
          technical_depth: prev.technical_depth,
          why_they_care: prev.why_they_care,
          curiosity_vectors: prev.curiosity_vectors || [],
        },
        current_state: {
          weight: targetWeight,
          technical_depth: validDepth,
          why_they_care: targetWhy,
          curiosity_vectors: allVectors,
        },
        weight_delta: Number((targetWeight - prev.weight).toFixed(2)),
        depth_changed: prev.technical_depth !== validDepth,
        why_changed: prev.why_they_care !== targetWhy,
      };
      diffs.push(diff);
      node.recent_topic_diffs = [diff, ...(node.recent_topic_diffs || []).slice(0, 30)];
    }

    const action: HarmonizationAction = {
      type: "merge",
      source_topics: sources,
      resulting_topics: [targetName],
      rationale: params.rationale || `Merged ${sources.length} entities into "${targetName}".`,
      before_state: beforeState,
      after_state: { [targetName]: newTargetMetadata },
    };

    return { changed: true, diffs, action };
  }

  /**
   * Splits a compound/multi-domain topic into distinct focused topic entities.
   */
  public static executeSplitTopic(
    node: UnifiedTopicNode,
    params: SplitTopicParams
  ): { changed: boolean; diffs: TopicUpdateDiff[]; action?: HarmonizationAction } {
    node.topics = node.topics || {};
    const srcName = params.source_topic.trim();
    const prev = node.topics[srcName];
    if (!prev) return { changed: false, diffs: [] };

    if (!Array.isArray(params.resulting_topics) || params.resulting_topics.length === 0) {
      return { changed: false, diffs: [] };
    }

    const timestamp = new Date().toISOString();
    delete node.topics[srcName];

    const afterState: Record<string, TopicMetadata> = {};
    const diffs: TopicUpdateDiff[] = [];

    for (const res of params.resulting_topics) {
      const resName = res.topic.trim();
      if (!resName) continue;

      const validDepth: TechnicalDepth = res.technical_depth &&
        ["introductory", "practitioner", "expert", "deep_technical"].includes(res.technical_depth)
          ? res.technical_depth
          : prev.technical_depth;

      const meta: TopicMetadata = {
        weight: Number(Math.min(1.0, Math.max(0.1, res.weight || prev.weight)).toFixed(2)),
        why_they_care: res.why_they_care || prev.why_they_care,
        technical_depth: validDepth,
        curiosity_vectors: res.curiosity_vectors || [resName],
        last_discussed_at: timestamp,
      };

      node.topics[resName] = meta;
      afterState[resName] = meta;

      const diff: TopicUpdateDiff = {
        topic_name: resName,
        timestamp,
        trigger_source: "interest_harmonizer",
        reasoning: params.rationale || `Split from "${srcName}".`,
        evidence: `SPLIT: ${srcName} -> ${params.resulting_topics.map((r) => r.topic).join(", ")}`,
        previous_state: {
          weight: prev.weight,
          technical_depth: prev.technical_depth,
          why_they_care: prev.why_they_care,
          curiosity_vectors: prev.curiosity_vectors || [],
        },
        current_state: {
          weight: meta.weight,
          technical_depth: validDepth,
          why_they_care: meta.why_they_care,
          curiosity_vectors: meta.curiosity_vectors || [],
        },
        weight_delta: Number((meta.weight - prev.weight).toFixed(2)),
        depth_changed: prev.technical_depth !== validDepth,
        why_changed: prev.why_they_care !== meta.why_they_care,
      };

      diffs.push(diff);
      node.recent_topic_diffs = [diff, ...(node.recent_topic_diffs || []).slice(0, 30)];
    }

    node.last_updated = timestamp;

    const action: HarmonizationAction = {
      type: "split",
      source_topics: [srcName],
      resulting_topics: Object.keys(afterState),
      rationale: params.rationale || `Split compound topic "${srcName}" into ${Object.keys(afterState).length} focused nodes.`,
      before_state: { [srcName]: prev },
      after_state: afterState,
    };

    return { changed: true, diffs, action };
  }

  /**
   * Deletes a topic with an explicit reason.
   */
  public static executeDeleteTopic(
    node: UnifiedTopicNode,
    params: DeleteTopicParams
  ): { changed: boolean; diff?: TopicUpdateDiff; action?: HarmonizationAction } {
    node.topics = node.topics || {};
    const topicName = params.topic.trim();
    const prev = node.topics[topicName];
    if (!prev) return { changed: false };

    const timestamp = new Date().toISOString();
    delete node.topics[topicName];
    node.last_updated = timestamp;

    const diff: TopicUpdateDiff = {
      topic_name: topicName,
      timestamp,
      trigger_source: "interest_harmonizer",
      reasoning: params.rationale || `Pruned topic ${topicName}.`,
      evidence: `DELETE: ${topicName}`,
      previous_state: {
        weight: prev.weight,
        technical_depth: prev.technical_depth,
        why_they_care: prev.why_they_care,
        curiosity_vectors: prev.curiosity_vectors || [],
      },
      current_state: {
        weight: 0,
        technical_depth: prev.technical_depth,
        why_they_care: "Pruned from knowledge graph.",
        curiosity_vectors: [],
      },
      weight_delta: -prev.weight,
      depth_changed: false,
      why_changed: true,
    };

    node.recent_topic_diffs = [diff, ...(node.recent_topic_diffs || []).slice(0, 30)];

    const action: HarmonizationAction = {
      type: "delete",
      source_topics: [topicName],
      resulting_topics: [],
      rationale: params.rationale || `Deleted topic "${topicName}".`,
      before_state: { [topicName]: prev },
    };

    return { changed: true, diff, action };
  }
}
