import { describe, it, expect, vi } from "vitest";
import { EpistemicEvaluator } from "../core/agents/discovery/epistemic-evaluator";
import { RawArticle } from "../core/types/contracts";
import { FreeNewsFetcher } from "../core/ingestion/rss-search";

describe("EpistemicEvaluator & Autonomous Deep Research", () => {
  const sampleArticle1: RawArticle = {
    title: "Breakthrough Solid-State Battery Prototype Achieves 1000 Wh/L Density",
    raw_text: "Researchers have demonstrated a solid-state lithium-metal battery cell achieving 1000 Wh/L energy density across 800 cycles in laboratory testing.",
    source_name: "Battery Technology Journal",
    source_url: "https://batterytech.example.com/solid-state-breakthrough",
    author_bias_rating: "center",
    topic_category: "Solid State Batteries",
  };

  const sampleArticle2: RawArticle = {
    title: "Automaker Partners with Material Lab for Next-Gen Cell Manufacturing",
    raw_text: "A commercial partnership was announced today to scale up electrolyte separator production for next-generation EV platforms.",
    source_name: "Automotive News Wire",
    source_url: "https://autonews.example.com/cell-manufacturing",
    author_bias_rating: "center",
    topic_category: "Solid State Batteries",
  };

  const sampleArticle3: RawArticle = {
    title: "Independent Energy Analyst Weighs in on High-Density Battery Commercialization",
    raw_text: "Industry analysts note that while 1000 Wh/L is a significant lab milestone, thermal management and manufacturing yield remain primary hurdles.",
    source_name: "Energy Transition Daily",
    source_url: "https://energytransition.example.com/analyst-take",
    author_bias_rating: "center",
    topic_category: "Solid State Batteries",
  };

  it("1. Flags single-source topic coverage as requiring deep research with follow-up queries", async () => {
    const evalResult = await EpistemicEvaluator.evaluateTopic("Solid State Batteries", [sampleArticle1]);

    expect(evalResult.topic).toBe("Solid State Batteries");
    expect(evalResult.source_breadth).toBe(1);
    expect(evalResult.distinct_publishers).toEqual(["Battery Technology Journal"]);
    expect(evalResult.needs_deep_research).toBe(true);
    expect(evalResult.is_sufficient).toBe(false);
    expect(evalResult.follow_up_queries.length).toBeGreaterThan(0);
  });

  it("2. Evaluates well-corroborated multi-source topics as epistemically sufficient", async () => {
    const evalResult = await EpistemicEvaluator.evaluateTopic("Solid State Batteries", [
      sampleArticle1,
      sampleArticle2,
      sampleArticle3,
    ]);

    expect(evalResult.source_breadth).toBe(3);
    expect(evalResult.distinct_publishers.length).toBe(3);
    expect(evalResult.is_sufficient).toBe(true);
    expect(evalResult.needs_deep_research).toBe(false);
  });

  it("3. Autonomous deep research loop triggers follow-up searches and enriches the candidate collection", async () => {
    // Spy on FreeNewsFetcher.searchNews to simulate returning additional wire articles
    const searchSpy = vi.spyOn(FreeNewsFetcher, "searchNews").mockResolvedValueOnce([
      {
        title: "Materials Science Team Explains Solid State Electrolyte Durability",
        raw_text: "Deep dive into the ceramic-polymer composite separators used to prevent dendrite formation.",
        source_name: "Science Wire International",
        source_url: "https://sciencewire.example.com/dendrite-prevention",
        author_bias_rating: "center",
        topic_category: "Solid State Batteries",
      },
    ]);

    const { enriched_articles, evaluations } = await EpistemicEvaluator.evaluateAndEnrich(
      ["Solid State Batteries"],
      [sampleArticle1] // Initial single article
    );

    expect(evaluations.length).toBe(1);
    expect(evaluations[0].needs_deep_research).toBe(true);
    expect(searchSpy).toHaveBeenCalled();
    expect(enriched_articles.length).toBeGreaterThan(1);
    expect(enriched_articles.some((a) => a.source_name === "Science Wire International")).toBe(true);

    searchSpy.mockRestore();
  });
});
