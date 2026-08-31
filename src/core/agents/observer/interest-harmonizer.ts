import { UnifiedTopicNode, TechnicalDepth, TopicMetadata } from "../../types/contracts";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { traceLogger } from "../../observability/trace-logger";

export interface HarmonizationAction {
  type: "merge" | "split" | "normalize";
  source_topics: string[];
  resulting_topics: string[];
  rationale: string;
}

export interface HarmonizationResult {
  harmonized_node: UnifiedTopicNode;
  actions_taken: HarmonizationAction[];
  changed: boolean;
}

export class InterestHarmonizer {
  /**
   * Evaluates the active interest graph, merging redundant/near-duplicate topics,
   * splitting amalgamated compound topics, and standardizing canonical topic entities.
   */
  public static async harmonize(unifiedNode: UnifiedTopicNode): Promise<HarmonizationResult> {
    const originalTopics = unifiedNode.topics || {};
    const topicKeys = Object.keys(originalTopics);

    if (topicKeys.length < 2) {
      return {
        harmonized_node: unifiedNode,
        actions_taken: [],
        changed: false,
      };
    }

    const adaptedNode: UnifiedTopicNode = JSON.parse(JSON.stringify(unifiedNode));
    adaptedNode.topics = adaptedNode.topics || {};

    const actionsTaken: HarmonizationAction[] = [];

    // Step 1: DeepSeek semantic reasoning if available
    if (deepseekProvider.isConfigured()) {
      try {
        const topicsFormatted = Object.entries(originalTopics).map(([name, meta]) => ({
          name,
          weight: meta.weight,
          technical_depth: meta.technical_depth,
          why_they_care: meta.why_they_care,
          curiosity_vectors: meta.curiosity_vectors,
        }));

        const systemPrompt = `You are the Knowledge Graph Harmonizer for Aletheia's Mind-State Memory Architecture.
Your role is to evaluate a user's active interest graph, and clean it up by:
1. MERGING near-duplicate, overlapping, or fragmented sub-topics that represent the same core epistemic interest (e.g. "AI Taxation" + "UBI Policy" + "AI Economic Fallout" -> "AI and Economic Policy").
2. SPLITTING compound, overloaded, or multi-domain amalgamations into distinct focused nodes (e.g. "Space Propulsion and Naval Warfare" -> "Space Logistics & Propulsion", "Naval Geopolitics").
3. PRESERVING standalone, distinct, and specialized topics untouched.

CRITICAL RULES:
- Do NOT invent or add brand new topics that the user never discussed.
- Consolidate motivations and combine curiosity vectors.
- Maintain accurate technical depth ("introductory", "practitioner", "expert", "deep_technical").
- Output the complete, cleaned, harmonized list of topics.

Output strict JSON:
{
  "actions": [
    {
      "type": "merge" | "split" | "normalize",
      "source_topics": ["Old Topic 1", "Old Topic 2"],
      "resulting_topics": ["Harmonized Canonical Topic"],
      "rationale": "Explanation of why these were merged or split"
    }
  ],
  "harmonized_topics": [
    {
      "name": "Canonical Topic Name",
      "weight": number (0.1 to 1.0),
      "technical_depth": "introductory" | "practitioner" | "expert" | "deep_technical",
      "why_they_care": "Consolidated user motivation",
      "curiosity_vectors": ["vector1", "vector2"]
    }
  ]
}`;

        const prompt = `Evaluate and harmonize these current user topics:\n${JSON.stringify(topicsFormatted, null, 2)}`;

        const result = await deepseekProvider.generateCompletion(prompt, {
          systemPrompt,
          temperature: 0.2,
        });

        const cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed.harmonized_topics) && parsed.harmonized_topics.length > 0) {
          const newTopicsMap: Record<string, TopicMetadata> = {};

          for (const ht of parsed.harmonized_topics) {
            if (!ht.name || typeof ht.name !== "string") continue;

            const validDepth: TechnicalDepth = ["introductory", "practitioner", "expert", "deep_technical"].includes(ht.technical_depth)
              ? ht.technical_depth
              : "practitioner";

            newTopicsMap[ht.name] = {
              weight: Number(Math.min(1.0, Math.max(0.1, ht.weight || 0.6)).toFixed(2)),
              why_they_care: ht.why_they_care || "Consolidated interest.",
              technical_depth: validDepth,
              curiosity_vectors: Array.isArray(ht.curiosity_vectors) ? ht.curiosity_vectors : [ht.name],
              last_discussed_at: new Date().toISOString(),
            };
          }

          if (Object.keys(newTopicsMap).length > 0) {
            adaptedNode.topics = newTopicsMap;
            if (Array.isArray(parsed.actions)) {
              actionsTaken.push(...parsed.actions);
            }

            adaptedNode.last_updated = new Date().toISOString();

            traceLogger.logTrace({
              trace_id: `harm_${Date.now()}`,
              session_id: `user_${unifiedNode.user_id}`,
              timestamp: new Date().toISOString(),
              node_name: "node_observer",
              input_summary: {
                initial_topics_count: topicKeys.length,
                initial_topics: topicKeys,
              },
              output_summary: {
                harmonized_topics_count: Object.keys(newTopicsMap).length,
                harmonized_topics: Object.keys(newTopicsMap),
                actions_count: actionsTaken.length,
              },
              reasoning_rationale: `Interest Harmonizer executed ${actionsTaken.length} graph harmonization actions.`,
              latency_ms: 0,
            });

            return {
              harmonized_node: adaptedNode,
              actions_taken: actionsTaken,
              changed: true,
            };
          }
        }
      } catch (err) {
        console.warn("InterestHarmonizer: LLM harmonization failed, falling back to heuristic cleanup:", err);
      }
    }

    // Step 2: Fallback heuristic clustering & deduplication (Token Jaccard & Substring matching)
    return this.heuristicHarmonize(adaptedNode);
  }

  /**
   * Fast, deterministic heuristic clustering when LLM is offline or for instant local deduplication
   */
  private static heuristicHarmonize(node: UnifiedTopicNode): HarmonizationResult {
    const topics = node.topics || {};
    const entries = Object.entries(topics);
    const merged: Record<string, TopicMetadata> = {};
    const actions: HarmonizationAction[] = [];
    const visited = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const [nameA, metaA] = entries[i];
      if (visited.has(nameA)) continue;

      const cluster: Array<[string, TopicMetadata]> = [[nameA, metaA]];
      visited.add(nameA);

      for (let j = i + 1; j < entries.length; j++) {
        const [nameB, metaB] = entries[j];
        if (visited.has(nameB)) continue;

        const lowerA = nameA.toLowerCase();
        const lowerB = nameB.toLowerCase();

        const stopWords = new Set(["and", "the", "or", "of", "in", "for", "with", "on", "to", "by", "about"]);
        const getSubstantiveTokens = (str: string) =>
          new Set(str.toLowerCase().split(/\W+/).filter((t) => t.length >= 2 && !stopWords.has(t)));

        const tokensA = getSubstantiveTokens(nameA);
        const tokensB = getSubstantiveTokens(nameB);

        const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
        const union = new Set([...tokensA, ...tokensB]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;
        const isSubset =
          (tokensA.size > 0 && [...tokensA].every((t) => tokensB.has(t))) ||
          (tokensB.size > 0 && [...tokensB].every((t) => tokensA.has(t)));

        if (lowerA.includes(lowerB) || lowerB.includes(lowerA) || jaccard >= 0.35 || isSubset) {
          cluster.push([nameB, metaB]);
          visited.add(nameB);
        }
      }

      if (cluster.length > 1) {
        // Pick the most comprehensive/longest canonical name
        const canonicalName = cluster.reduce((best, cur) => (cur[0].length > best.length ? cur[0] : best), cluster[0][0]);
        const combinedWeight = Number(Math.min(1.0, Math.max(...cluster.map((c) => c[1].weight)) + 0.05).toFixed(2));
        const allVectors = Array.from(new Set(cluster.flatMap((c) => c[1].curiosity_vectors || [])));
        const bestWhy = cluster.map((c) => c[1].why_they_care).filter(Boolean).join(" ");

        merged[canonicalName] = {
          weight: combinedWeight,
          why_they_care: bestWhy || metaA.why_they_care,
          technical_depth: metaA.technical_depth || "practitioner",
          curiosity_vectors: allVectors.length > 0 ? allVectors : [canonicalName],
          last_discussed_at: new Date().toISOString(),
        };

        actions.push({
          type: "merge",
          source_topics: cluster.map((c) => c[0]),
          resulting_topics: [canonicalName],
          rationale: `Merged ${cluster.length} closely related topic variations into "${canonicalName}".`,
        });
      } else {
        merged[nameA] = metaA;
      }
    }

    const changed = actions.length > 0;
    node.topics = merged;
    node.last_updated = new Date().toISOString();

    return {
      harmonized_node: node,
      actions_taken: actions,
      changed,
    };
  }
}
