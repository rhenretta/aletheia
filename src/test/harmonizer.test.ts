import { describe, it, expect, vi, beforeEach } from "vitest";
import { InterestHarmonizer } from "../core/agents/observer/interest-harmonizer";
import { UnifiedTopicNode } from "../core/types/contracts";
import { deepseekProvider } from "../core/llm/deepseek-provider";

describe("InterestHarmonizer: Semantic Topic Merging and Splitting", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("executes discrete merge_topics tool calls cleanly with merged curiosity vectors", async () => {
    vi.spyOn(deepseekProvider, "isConfigured").mockReturnValue(true);
    vi.spyOn(deepseekProvider, "generateCompletion").mockResolvedValue({
      tokensUsed: 120,
      text: JSON.stringify({
        structural_rationale: "AI Policy and AI and Economic Policy overlap extensively; merging into canonical AI and Economic Policy node.",
        tool_calls: [
          {
            rationale: "Consolidate overlapping AI policy nodes into a unified knowledge structure.",
            tool: "merge_topics",
            parameters: {
              source_topics: ["AI and Economic Policy", "AI Policy"],
              resulting_topic: "AI and Economic Policy",
              why_they_care: "Concerns about automation, revenue stability, and general governance.",
              technical_depth: "practitioner",
              curiosity_vectors: ["taxation", "automation", "policy", "regulations"],
            },
          },
        ],
        summary: "Merged 2 overlapping AI policy topics into canonical node.",
      }),
    });

    const node: UnifiedTopicNode = {
      user_id: "usr_test",
      topics: {
        "AI and Economic Policy": {
          weight: 0.8,
          why_they_care: "Concerns about automation and revenue stability.",
          technical_depth: "practitioner",
          curiosity_vectors: ["taxation", "automation"],
          last_discussed_at: new Date().toISOString(),
        },
        "AI Policy": {
          weight: 0.7,
          why_they_care: "General governance and policy interest.",
          technical_depth: "practitioner",
          curiosity_vectors: ["policy", "regulations"],
          last_discussed_at: new Date().toISOString(),
        },
        "Space Logistics & Propulsion": {
          weight: 0.85,
          why_they_care: "Cislunar logistics and reusability economics.",
          technical_depth: "expert",
          curiosity_vectors: ["starship", "nuclear propulsion"],
          last_discussed_at: new Date().toISOString(),
        },
      },
      psychological_profile: {
        emotional_trajectory: "Curious",
        sensitivities: [],
        boundaries: [],
        communication_style: "Direct",
      },
      discovery_parameters: {
        signal_threshold: 0.7,
        anti_preferences: [],
        exploration_rate: 0.2,
        depth_requirement: "practitioner",
      },
      historical_anchors: [],
      dwell_history: [],
      last_updated: new Date().toISOString(),
    };

    const result = await InterestHarmonizer.harmonize(node);
    expect(result.changed).toBe(true);

    const harmonizedTopicNames = Object.keys(result.harmonized_node.topics);
    expect(harmonizedTopicNames.length).toBe(2);
    expect(harmonizedTopicNames.some((t) => t.includes("Space"))).toBe(true);
    expect(harmonizedTopicNames.some((t) => t === "AI and Economic Policy")).toBe(true);
    expect(harmonizedTopicNames.includes("AI Policy")).toBe(false);
  });
});
