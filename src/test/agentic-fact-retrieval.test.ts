import { describe, it, expect } from "vitest";
import { LiveSearchEngine } from "../core/ingestion/live-search-engine";
import { ContextAgent } from "../core/agents/context/context-agent";
import { DataPersistenceStore } from "../core/storage/persistence";
import { DialogueAgent, ChatMessage } from "../core/agents/intake/dialogue-agent";

describe("Agentic Fact Retrieval & Epistemic Grounding Engine", () => {
  it("LiveSearchEngine extracts structured articles with substantive snippets and clean URLs", async () => {
    const articles = await LiveSearchEngine.search("artificial intelligence compute data center energy", 3);
    
    expect(articles).toBeDefined();
    expect(Array.isArray(articles)).toBe(true);
    if (articles.length > 0) {
      const first = articles[0];
      expect(first.title).toBeDefined();
      expect(first.title.length).toBeGreaterThan(5);
      expect(first.source_url).toMatch(/^https?:\/\//);
      expect(first.source_name).toBeDefined();
      expect(first.raw_text.length).toBeGreaterThan(15);
      // Ensure HTML entities are decoded
      expect(first.raw_text).not.toContain("&#x27;");
      expect(first.raw_text).not.toContain("&quot;");
    }
  });

  it("ContextAgent isolates stale topic baggage and prevents inactive safeguards from bleeding into novel topics", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_isolation_test");
    
    // Register topics and topic-anchored safeguards for Topic A
    node.topics["Electric Vehicle Battery Chemistry"] = {
      weight: 0.95,
      why_they_care: "Deeply interested in lithium iron phosphate and solid-state battery energy density.",
      technical_depth: "expert",
      curiosity_vectors: ["solid-state", "LFP", "dendrite formation"],
      last_discussed_at: new Date().toISOString(),
    };
    node.psychological_profile.sensitivities = [
      "Sensitive to claims that electric vehicle battery chemistry degrades prematurely in cold weather",
      "Prefers rigorous empirical peer-reviewed data over speculative social media claims", // Universal
    ];
    node.psychological_profile.boundaries = [
      "Avoid claiming electric vehicle battery chemistry is unviable without citing specific cycle data",
      "Strict adherence to verifiable evidence", // Universal
    ];
    node.psychological_profile.emotional_trajectory = "Strong advocate for electric vehicle battery chemistry advancements";

    // User asks about a completely novel domain (Topic B)
    const framing = await ContextAgent.generateContextFraming(
      node,
      [
        { role: "user", content: "I've been looking into high-temperature superconductors recently." },
        { role: "assistant", content: "Superconductivity at ambient pressures remains one of condensed matter physics' greatest challenges." },
      ],
      "Did the recent claims about ambient pressure lead-apatite crystals ever get replicated independently?"
    );

    // 1. Inactive Topic A safeguards must NOT bleed into Topic B context
    const instructions = framing.empath_instructions;
    expect(instructions).not.toContain("degrades prematurely in cold weather");
    expect(instructions).not.toContain("battery chemistry is unviable");
    expect(framing.active_sensitivities.some((s) => s.includes("battery"))).toBe(false);
    expect(framing.active_boundaries.some((b) => b.includes("battery"))).toBe(false);

    // 2. Universal safeguards MUST remain preserved
    expect(framing.active_sensitivities.some((s) => s.includes("empirical peer-reviewed data"))).toBe(true);
    expect(framing.active_boundaries.some((b) => b.includes("verifiable evidence"))).toBe(true);

    // 3. Emotional trajectory must NOT claim they are an advocate for the inactive topic
    expect(framing.empath_instructions).not.toContain("Strong advocate for electric vehicle battery chemistry advancements");

    // 4. Activated graph topics should not force-bind the inactive battery topic
    expect(framing.why_they_care_context.some((t) => t.includes("Electric Vehicle Battery Chemistry"))).toBe(false);
  });

  it("DialogueAgent streams agentic tool events and produces grounded context envelope", async () => {
    const node = DataPersistenceStore.createDefaultUnifiedTopicNode("usr_dialogue_grounding_test");
    const history: ChatMessage[] = [
      {
        id: "msg_1",
        role: "user",
        content: "What are the latest verified status reports on commercial fusion reactor net energy milestones?",
        timestamp: new Date().toISOString(),
      },
    ];

    const stream = DialogueAgent.chatStream(history, node);
    const events: string[] = [];
    let metaResponse: any = null;

    for await (const chunk of stream) {
      events.push(chunk.type);
      if (chunk.type === "meta") {
        metaResponse = chunk.data;
      }
    }

    expect(events).toContain("token");
    expect(events).toContain("meta");
    expect(metaResponse).toBeDefined();
    expect(metaResponse.message).toBeDefined();
    expect(metaResponse.agent_internal_rationale).toBeDefined();
    expect(metaResponse.context_generated).toBeDefined();
    expect(metaResponse.context_generated.raw_prompt_sent_to_llm).toBeDefined();
    expect(metaResponse.context_generated.raw_system_prompt).toContain("INLINE CITATION MANDATE");
    expect(metaResponse.context_generated.raw_system_prompt).toContain("GRANULAR CLAIM DECOMPOSITION");
  });
});
