import {
  UnifiedTopicNode,
  TechnicalDepth,
  TopicMetadata,
  HarmonizationAction,
  HarmonizationRun,
  TopicUpdateDiff,
} from "../../types/contracts";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { traceLogger } from "../../observability/trace-logger";

export interface HarmonizationResult {
  harmonized_node: UnifiedTopicNode;
  actions_taken: HarmonizationAction[];
  harmonization_run?: HarmonizationRun;
  changed: boolean;
}

export class InterestHarmonizer {
  /**
   * Evaluates the active interest graph, merging redundant/near-duplicate topics,
   * splitting amalgamated compound topics, and standardizing canonical topic entities.
   * Produces an immutable, glass-box HarmonizationRun audit trail for user inspection.
   */
  public static async harmonize(
    unifiedNode: UnifiedTopicNode,
    triggerSource: "background_observer" | "manual_user" = "manual_user"
  ): Promise<HarmonizationResult> {
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
    adaptedNode.harmonization_runs = adaptedNode.harmonization_runs || [];
    adaptedNode.recent_topic_diffs = adaptedNode.recent_topic_diffs || [];

    const actionsTaken: HarmonizationAction[] = [];
    const timestamp = new Date().toISOString();
    const runId = `run_harm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const traceId = `trace_harm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
1. MERGING ONLY near-duplicate, overlapping, or fragmented sub-topics that represent the exact same core entity (e.g. "SpaceX Starship" + "Starship Rocket Launch" -> "SpaceX Starship").
2. SPLITTING compound, overloaded, or multi-domain amalgamations into distinct focused nodes.
3. PRESERVING ALL standalone, distinct, and specialized topics untouched.

CRITICAL PRESERVATION RULES:
- NEVER DROP, OMIT, OR SUMMARIZE AWAY DISTINCT USER INTERESTS.
- If the user has 10, 20, or 50 distinct topics, you MUST return all 10, 20, or 50 topics in "harmonized_topics".
- Different or orthogonal domains (e.g. "AI and Economic Policy", "Commercial Spaceflight", "Geopolitics of Iran", "Quantum Computing") MUST REMAIN SEPARATE. NEVER merge distinct fields into a generic bucket.
- Provide explicit, clear "rationale" explaining why any topics were combined, split, or modified.
- Maintain accurate technical depth ("introductory", "practitioner", "expert", "deep_technical").
- Output strict JSON:
{
  "actions": [
    {
      "type": "merge" | "split" | "normalize" | "delete" | "edit",
      "source_topics": ["Old Topic 1", "Old Topic 2"],
      "resulting_topics": ["Harmonized Topic"],
      "rationale": "Clear explanation of why this action occurred"
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
  ],
  "summary": "High-level 1-2 sentence overview of the harmonization run"
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
              for (const act of parsed.actions) {
                const beforeState: Record<string, any> = {};
                for (const src of act.source_topics || []) {
                  if (originalTopics[src]) beforeState[src] = originalTopics[src];
                }
                const afterState: Record<string, any> = {};
                for (const res of act.resulting_topics || []) {
                  if (newTopicsMap[res]) afterState[res] = newTopicsMap[res];
                }

                actionsTaken.push({
                  type: act.type || "normalize",
                  source_topics: act.source_topics || [],
                  resulting_topics: act.resulting_topics || [],
                  rationale: act.rationale || "Knowledge graph harmonization.",
                  before_state: Object.keys(beforeState).length > 0 ? beforeState : undefined,
                  after_state: Object.keys(afterState).length > 0 ? afterState : undefined,
                });
              }
            }

            // Generate structured topic update diffs for full transparency
            for (const act of actionsTaken) {
              for (const src of act.source_topics) {
                const prev = originalTopics[src];
                const resName = act.resulting_topics[0];
                const next = newTopicsMap[resName];

                if (prev) {
                  const diff: TopicUpdateDiff = {
                    topic_name: src,
                    timestamp,
                    trigger_source: "interest_harmonizer",
                    reasoning: act.rationale,
                    evidence: `${act.type.toUpperCase()}: ${act.source_topics.join(", ")} -> ${act.resulting_topics.join(", ")}`,
                    previous_state: {
                      weight: prev.weight,
                      technical_depth: prev.technical_depth,
                      why_they_care: prev.why_they_care,
                      curiosity_vectors: prev.curiosity_vectors || [],
                    },
                    current_state: {
                      weight: next ? next.weight : 0,
                      technical_depth: next ? next.technical_depth : prev.technical_depth,
                      why_they_care: next ? next.why_they_care : "Harmonized into new canonical node.",
                      curiosity_vectors: next ? next.curiosity_vectors || [] : [],
                    },
                    weight_delta: next ? Number((next.weight - prev.weight).toFixed(2)) : -prev.weight,
                    depth_changed: next ? prev.technical_depth !== next.technical_depth : false,
                    why_changed: next ? prev.why_they_care !== next.why_they_care : true,
                  };
                  adaptedNode.recent_topic_diffs = [diff, ...adaptedNode.recent_topic_diffs.slice(0, 30)];
                }
              }
            }

            const runSummary =
              parsed.summary ||
              `Harmonized ${topicKeys.length} topics into ${Object.keys(newTopicsMap).length} canonical nodes via ${actionsTaken.length} actions.`;

            const harmonizationRun: HarmonizationRun = {
              run_id: runId,
              timestamp,
              trigger_source: triggerSource,
              summary: runSummary,
              actions: actionsTaken,
              trace_id: traceId,
              topics_before_count: topicKeys.length,
              topics_after_count: Object.keys(newTopicsMap).length,
            };

            adaptedNode.harmonization_runs = [harmonizationRun, ...adaptedNode.harmonization_runs.slice(0, 20)];
            adaptedNode.last_updated = timestamp;

            traceLogger.logTrace({
              trace_id: traceId,
              session_id: `user_${unifiedNode.user_id}`,
              timestamp,
              node_name: "node_observer",
              input_summary: {
                initial_topics_count: topicKeys.length,
                initial_topics: topicKeys,
                trigger_source: triggerSource,
              },
              output_summary: {
                harmonized_topics_count: Object.keys(newTopicsMap).length,
                harmonized_topics: Object.keys(newTopicsMap),
                actions_count: actionsTaken.length,
                run_id: runId,
              },
              reasoning_rationale: `Harmonization run [${triggerSource}]: ${runSummary}`,
              latency_ms: 0,
            });

            return {
              harmonized_node: adaptedNode,
              actions_taken: actionsTaken,
              harmonization_run: harmonizationRun,
              changed: true,
            };
          }
        }
      } catch (err) {
        console.warn("InterestHarmonizer: LLM harmonization failed, falling back to heuristic cleanup:", err);
      }
    }

    // Step 2: Fallback heuristic clustering
    return this.heuristicHarmonize(adaptedNode, triggerSource);
  }

  /**
   * Fast, deterministic heuristic clustering when LLM is offline
   */
  private static heuristicHarmonize(
    node: UnifiedTopicNode,
    triggerSource: "background_observer" | "manual_user"
  ): HarmonizationResult {
    const topics = node.topics || {};
    const entries = Object.entries(topics);
    const initialCount = entries.length;
    const merged: Record<string, TopicMetadata> = {};
    const actions: HarmonizationAction[] = [];
    const visited = new Set<string>();
    const timestamp = new Date().toISOString();
    const runId = `run_harm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const traceId = `trace_harm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    for (let i = 0; i < entries.length; i++) {
      const [nameA, metaA] = entries[i];
      if (visited.has(nameA)) continue;

      const cluster: Array<[string, TopicMetadata]> = [[nameA, metaA]];
      visited.add(nameA);

      for (let j = i + 1; j < entries.length; j++) {
        const [nameB, metaB] = entries[j];
        if (visited.has(nameB)) continue;

        const cleanLowerA = nameA.toLowerCase().trim();
        const cleanLowerB = nameB.toLowerCase().trim();

        const stopWords = new Set(["and", "the", "or", "of", "in", "for", "with", "on", "to", "by", "about"]);
        const getSubstantiveTokens = (str: string) =>
          new Set(str.toLowerCase().split(/\W+/).filter((t) => t.length >= 2 && !stopWords.has(t)));

        const tokensA = getSubstantiveTokens(nameA);
        const tokensB = getSubstantiveTokens(nameB);

        const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
        const union = new Set([...tokensA, ...tokensB]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;

        // Equivalence: identical string, multi-word subset (e.g. "AI Policy" in "AI and Economic Policy"), or >= 65% token Jaccard
        const isExactMatch = cleanLowerA === cleanLowerB;
        const isNearExactMatch = jaccard >= 0.65 && tokensA.size >= 2 && tokensB.size >= 2;
        const isMultiWordSubset =
          (tokensA.size >= 2 && [...tokensA].every((t) => tokensB.has(t))) ||
          (tokensB.size >= 2 && [...tokensB].every((t) => tokensA.has(t)));

        if (isExactMatch || isNearExactMatch || isMultiWordSubset) {
          cluster.push([nameB, metaB]);
          visited.add(nameB);
        }
      }

      if (cluster.length > 1) {
        const canonicalName = cluster.reduce((best, cur) => (cur[0].length > best.length ? cur[0] : best), cluster[0][0]);
        const combinedWeight = Number(Math.min(1.0, Math.max(...cluster.map((c) => c[1].weight)) + 0.05).toFixed(2));
        const allVectors = Array.from(new Set(cluster.flatMap((c) => c[1].curiosity_vectors || [])));
        const bestWhy = cluster.map((c) => c[1].why_they_care).filter(Boolean).join(" ");

        merged[canonicalName] = {
          weight: combinedWeight,
          why_they_care: bestWhy || metaA.why_they_care,
          technical_depth: metaA.technical_depth || "practitioner",
          curiosity_vectors: allVectors.length > 0 ? allVectors : [canonicalName],
          last_discussed_at: timestamp,
        };

        actions.push({
          type: "merge",
          source_topics: cluster.map((c) => c[0]),
          resulting_topics: [canonicalName],
          rationale: `Merged ${cluster.length} overlapping topic phrases into canonical node "${canonicalName}".`,
        });
      } else {
        merged[nameA] = metaA;
      }
    }

    const changed = actions.length > 0;
    node.topics = merged;
    node.last_updated = timestamp;

    let harmonizationRun: HarmonizationRun | undefined;
    if (changed) {
      harmonizationRun = {
        run_id: runId,
        timestamp,
        trigger_source: triggerSource,
        summary: `Heuristic clustering consolidated ${initialCount} topics into ${Object.keys(merged).length} nodes.`,
        actions,
        trace_id: traceId,
        topics_before_count: initialCount,
        topics_after_count: Object.keys(merged).length,
      };
      node.harmonization_runs = [harmonizationRun, ...(node.harmonization_runs || []).slice(0, 20)];
    }

    return {
      harmonized_node: node,
      actions_taken: actions,
      harmonization_run: harmonizationRun,
      changed,
    };
  }
}
