import { describe, it, expect } from "vitest";
import { executeAletheiaPipeline } from "../core/graph/state-graph";
import { RawArticle } from "../core/types/contracts";

describe("LangGraph Multi-Agent Pipeline Execution", () => {
  it("orchestrates StateGraph from Node A through Node D with trace logging and living doc sync", async () => {
    const rawArticles: RawArticle[] = [
      {
        source_url: "https://news1.example.com/quantum-leap",
        source_name: "Tech Tribune",
        title: "Quantum Processor Breakthrough Announced",
        author_bias_rating: "center",
        raw_text:
          "Researchers successfully achieved quantum advantage with a 1,000-qubit processor at 15 millikelvin temperatures. Commercial applications are estimated within 3 years.",
      },
      {
        source_url: "https://news2.example.com/quantum-skeptic",
        source_name: "Market Insider",
        title: "Overhyped Quantum Claims Face Scrutiny",
        author_bias_rating: "lean_right",
        raw_text:
          "Despite sensationalized marketing, researchers demonstrated 1,000-qubit operation at 15 millikelvin. Industry analysts warn that error correction hurdles remain formidable.",
      },
    ];

    const result = await executeAletheiaPipeline({
      sessionId: "test-pipeline-run",
      userId: "usr_alex",
      articles: rawArticles,
    });

    // Verify Node A output in state
    expect(result.current_facts).toBeDefined();
    expect(result.current_facts.length).toBeGreaterThan(0);
    expect(result.current_facts[0].agreed_facts.length).toBeGreaterThan(0);

    // Verify Node B user graph in state
    expect(result.user_graph).toBeDefined();
    expect(result.user_graph?.user_id).toBe("usr_alex");

    // Verify Node C routing decision in state
    expect(result.routing_decision).toBeDefined();
    expect(["exploitation", "exploration"]).toContain(result.routing_decision?.strategy);

    // Verify Node D presentation payload in state
    expect(result.presentation_payload).toBeDefined();
    expect(result.presentation_payload?.headline).toBeDefined();
    expect(result.presentation_payload?.fact_bullets.length).toBeGreaterThan(0);

    // Verify multi-topic feed cards generated
    expect(result.feed_cards).toBeDefined();
    expect(result.feed_cards?.length).toBeGreaterThan(0);

    // Verify Traces recorded for each node transition
    expect(result.traces?.length).toBeGreaterThanOrEqual(4);
    const nodeNames = result.traces?.map((t) => t.node_name) || [];
    expect(nodeNames).toContain("node_a_epistemology");
    expect(nodeNames).toContain("node_b_telemetry");
    expect(nodeNames).toContain("node_c_serendipity");
    expect(nodeNames).toContain("node_d_synthesis");
  });
});
