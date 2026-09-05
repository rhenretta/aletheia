import { describe, it, expect, vi } from "vitest";
import { TopicRelevanceFilter } from "../core/agents/discovery/topic-relevance-filter";
import { DiscoveryAgent } from "../core/agents/discovery/discovery-agent";
import { RawArticle, UnifiedTopicNode } from "../core/types/contracts";

describe("TopicRelevanceFilter: Semantic & Homonym Noise Gate", () => {
  it("rejects commercial travel aggregators and booking listings", async () => {
    const candidateArticles: RawArticle[] = [
      {
        source_url: "https://www.expedia.com/Flights-Search?flight=FSD-HNL",
        source_name: "Expedia",
        title: "Cheap Flights from FSD to Honolulu starting at $378",
        raw_text: "Find cheap flights between Sioux Falls Regional Airport (FSD) and Honolulu (HNL) with American Airlines.",
        topic_category: "FSD 14 3 7 reception",
        author_bias_rating: "center",
        published_at: new Date().toISOString(),
      },
    ];

    const result = await TopicRelevanceFilter.filterArticles(candidateArticles);

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toContain("Transactional fare/booking aggregator");
  });

  it("rejects acronym and homonym collisions where content discusses an unrelated domain", async () => {
    const candidateArticles: RawArticle[] = [
      {
        source_url: "https://travelnews.example.com/sioux-falls-routes",
        source_name: "Travel Daily",
        title: "Sioux Falls–Honolulu Air Route Sees $378 Fares as American Airlines Enters Market",
        raw_text: "Travelers can now book flights between Sioux Falls Regional Airport (FSD) and Honolulu's airport starting at $378 with new airline service.",
        topic_category: "FSD 14 3 7 reception",
        author_bias_rating: "center",
        published_at: new Date().toISOString(),
      },
      {
        source_url: "https://wetalktesla.com/2026/08/02/tesla-fsd-14-3-7-jerky-turns-ignored/",
        source_name: "We Talk Tesla",
        title: "Tesla Pushes FSD 14.3.7 After Drivers Flag Jerky Turns and Ignored Maneuvers",
        raw_text: "Tesla has rolled out FSD v14.3.7 addressing rough turns and navigation hesitation reported in early testing.",
        topic_category: "FSD 14 3 7 reception",
        author_bias_rating: "center",
        published_at: new Date().toISOString(),
      },
    ];

    const result = await TopicRelevanceFilter.filterArticles(candidateArticles);

    // The airport story must be rejected, while the genuine FSD software article must be accepted
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].title).toContain("Tesla Pushes FSD 14.3.7");

    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].article.title).toContain("Sioux Falls");
    expect(result.rejected[0].reason).toContain("Acronym/homonym collision");
  });

  it("DiscoveryAgent prunes off-topic articles and records them in rejection_reasons", async () => {
    const mockUnifiedNode: UnifiedTopicNode = {
      user_id: "usr_test",
      topics: {
        "FSD 14 3 7 reception": {
          weight: 0.95,
          why_they_care: "Monitoring autonomous driving software reliability and real-world testing",
          technical_depth: "practitioner",
          curiosity_vectors: [],
        },
      },
      psychological_profile: {
        emotional_trajectory: "Focused on technical rigor and reliability",
        sensitivities: [],
        boundaries: [],
        communication_style: "Concise peer",
      },
      discovery_parameters: {
        signal_threshold: 0.8,
        anti_preferences: ["clickbait", "rumors"],
        exploration_rate: 0.2,
        depth_requirement: "practitioner",
      },
      historical_anchors: [],
      last_updated: new Date().toISOString(),
    };

    // Spy on NewsCollector to return mixed candidate pool
    const { NewsCollector } = await import("../core/agents/collector/news-collector");
    const { FreeNewsFetcher } = await import("../core/ingestion/rss-search");
    vi.spyOn(FreeNewsFetcher, "searchNews").mockResolvedValue([]);
    vi.spyOn(NewsCollector, "collectForTopics").mockResolvedValueOnce([
      {
        topic: "FSD 14 3 7 reception",
        source_perspectives: [],
        articles: [
          {
            source_url: "https://www.expedia.com/flights/fsd",
            source_name: "Expedia",
            title: "Sioux Falls (FSD) Airfare Specials",
            raw_text: "Book cheap flights out of FSD airport today with discounts across multiple major domestic carriers.",
            topic_category: "FSD 14 3 7 reception",
            author_bias_rating: "center",
            published_at: new Date().toISOString(),
          },
          {
            source_url: "https://notateslaapp.com/software-updates/version/2026.21.5/release-notes",
            source_name: "Not a Tesla App",
            title: "Update 2026.21.5 (FSD 14.3.7) Release Notes",
            raw_text: "Tesla full self-driving version 14.3.7 is rolling out to customer vehicles with refined behavior and patch fixes.",
            topic_category: "FSD 14 3 7 reception",
            author_bias_rating: "center",
            published_at: new Date().toISOString(),
          },
        ],
      },
    ]);

    const batch = await DiscoveryAgent.curateAndCollect(mockUnifiedNode, ["FSD 14 3 7 reception"]);

    expect(batch.accepted_articles).toHaveLength(1);
    expect(batch.accepted_articles[0].title).toBe("Update 2026.21.5 (FSD 14.3.7) Release Notes");
    expect(batch.rejected_articles_count).toBeGreaterThanOrEqual(1);
    const airportRejection = batch.rejection_reasons.find((r) => r.title.includes("Sioux Falls"));
    expect(airportRejection).toBeDefined();
  });
});
