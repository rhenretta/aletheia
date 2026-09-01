import {
  UnifiedTopicNode,
  TopicMetadata,
  HarmonizationAction,
  HarmonizationRun,
} from "../../types/contracts";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { traceLogger } from "../../observability/trace-logger";
import { TopicMutationEngine } from "./topic-mutation-engine";

export interface HarmonizationResult {
  harmonized_node: UnifiedTopicNode;
  actions_taken: HarmonizationAction[];
  harmonization_run?: HarmonizationRun;
  changed: boolean;
}

export class InterestHarmonizer {
  /**
   * Evaluates the active interest graph and executes DISCRETE atomic mutation tools
   * (merge_topics, split_topic, delete_topic, update_topic) one by one.
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

    // Step 1: DeepSeek discrete tool calling if available
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
Your role is to evaluate a user's active interest graph and emit DISCRETE MUTATION TOOL CALLS to clean it up.
You NEVER recreate or return the full graph. You ONLY emit specific tool calls for nodes that need merging, splitting, updating, or deletion.

AVAILABLE MUTATION TOOLS:
1. "merge_topics": Merge two or more near-duplicate/overlapping entities into one canonical entity.
   parameters: { "source_topics": string[], "resulting_topic": string, "why_they_care": string, "technical_depth": string, "curiosity_vectors": string[], "rationale": string }

2. "split_topic": Split a compound/multi-domain topic into distinct focused nodes.
   parameters: { "source_topic": string, "resulting_topics": [{ "topic": string, "weight": number, "why_they_care": string, "technical_depth": string, "curiosity_vectors": string[] }], "rationale": string }

3. "delete_topic": Prune an obsolete or invalid topic.
   parameters: { "topic": string, "rationale": string }

4. "update_topic": Update metadata or technical depth on an existing topic.
   parameters: { "topic": string, "weight_delta": number, "why_they_care": string, "technical_depth": string, "curiosity_vectors_to_add": string[], "rationale": string }

CRITICAL RULES:
- ONLY emit tool calls for topics that genuinely require merging or splitting.
- Standalone, distinct topics (e.g. "AI Policy", "Commercial Spaceflight", "Iran Geopolitics") MUST BE LEFT ALONE. If no merge/split is needed, "tool_calls" MUST be empty ([]).
- DO NOT invent new topics that were never in the user's graph.

Output strict JSON:
{
  "tool_calls": [
    {
      "tool": "merge_topics" | "split_topic" | "delete_topic" | "update_topic",
      "parameters": { ... }
    }
  ],
  "summary": "1-2 sentence overview of structural changes (or 'No structural adjustments needed')"
}`;

        const prompt = `Evaluate and emit discrete mutation tool calls for these active topics:\n${JSON.stringify(topicsFormatted, null, 2)}`;

        const result = await deepseekProvider.generateCompletion(prompt, {
          systemPrompt,
          temperature: 0.2,
        });

        const cleanJson = result.text.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
          for (const tc of parsed.tool_calls) {
            const p = tc.parameters || tc;

            if (tc.tool === "merge_topics") {
              const res = TopicMutationEngine.executeMergeTopics(adaptedNode, p);
              if (res.changed && res.action) {
                actionsTaken.push(res.action);
              }
            } else if (tc.tool === "split_topic") {
              const res = TopicMutationEngine.executeSplitTopic(adaptedNode, p);
              if (res.changed && res.action) {
                actionsTaken.push(res.action);
              }
            } else if (tc.tool === "delete_topic") {
              const res = TopicMutationEngine.executeDeleteTopic(adaptedNode, p);
              if (res.changed && res.action) {
                actionsTaken.push(res.action);
              }
            } else if (tc.tool === "update_topic") {
              const res = TopicMutationEngine.executeUpdateTopic(adaptedNode, p, "interest_harmonizer");
              if (res.changed) {
                actionsTaken.push({
                  type: "edit",
                  source_topics: [p.topic],
                  resulting_topics: [p.topic],
                  rationale: p.rationale || `Updated topic ${p.topic}.`,
                });
              }
            }
          }

          const runSummary =
            parsed.summary ||
            (actionsTaken.length > 0
              ? `Executed ${actionsTaken.length} discrete graph mutation tool actions on ${topicKeys.length} topics.`
              : `Evaluated ${topicKeys.length} active topics. All topics are distinct and well-formed; no merges or splits required.`);

          const harmonizationRun: HarmonizationRun = {
            run_id: runId,
            timestamp,
            trigger_source: triggerSource,
            summary: runSummary,
            actions: actionsTaken,
            trace_id: traceId,
            topics_before_count: topicKeys.length,
            topics_after_count: Object.keys(adaptedNode.topics).length,
          };

          adaptedNode.harmonization_runs = [harmonizationRun, ...(adaptedNode.harmonization_runs || []).slice(0, 20)];
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
              harmonized_topics_count: Object.keys(adaptedNode.topics).length,
              harmonized_topics: Object.keys(adaptedNode.topics),
              actions_count: actionsTaken.length,
              run_id: runId,
            },
            reasoning_rationale: `Harmonization tool run [${triggerSource}]: ${runSummary}`,
            latency_ms: 0,
          });

          return {
            harmonized_node: adaptedNode,
            actions_taken: actionsTaken,
            harmonization_run: harmonizationRun,
            changed: actionsTaken.length > 0,
          };
        }
      } catch (err) {
        console.warn("InterestHarmonizer: LLM tool harmonization error, falling back to heuristic cleanup:", err);
      }
    }

    // Step 2: Fallback heuristic clustering (only merges strict duplicate subphrases)
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
