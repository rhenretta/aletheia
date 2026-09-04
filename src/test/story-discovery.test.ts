import { describe, it, expect, vi, beforeEach } from "vitest";
import { StoryDiscoveryEngine } from "../core/ingestion/story-discovery-engine";
import { TopicCardEvolutionOrchestrator } from "../core/agents/cards/topic-card-evolution-orchestrator";
import { LiveSearchEngine } from "../core/ingestion/live-search-engine";
import { FreeNewsFetcher } from "../core/ingestion/rss-search";

describe("StoryDiscoveryEngine & Story vs Source Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("classifyWebResource", () => {
    it("should classify root domain and single-word product pages as source_hub", () => {
      expect(StoryDiscoveryEngine.classifyWebResource("https://tesla.com")).toBe("source_hub");
      expect(StoryDiscoveryEngine.classifyWebResource("https://tesla.com/")).toBe("source_hub");
      expect(StoryDiscoveryEngine.classifyWebResource("https://tesla.com/fsd")).toBe("source_hub");
      expect(StoryDiscoveryEngine.classifyWebResource("https://apple.com/autopilot")).toBe("source_hub");
      expect(StoryDiscoveryEngine.classifyWebResource("https://notateslaapp.com/fsd-beta/")).toBe("source_hub");
    });

    it("should classify topic and category index directories as source_hub", () => {
      expect(
        StoryDiscoveryEngine.classifyWebResource("https://teslaoracle.com/topic/autopilot/")
      ).toBe("source_hub");
      expect(
        StoryDiscoveryEngine.classifyWebResource("https://techcrunch.com/category/robotics/")
      ).toBe("source_hub");
      expect(
        StoryDiscoveryEngine.classifyWebResource("https://example.com/tag/ai-agents/")
      ).toBe("source_hub");
    });

    it("should classify directory titles as source_hub", () => {
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://example.com/updates",
          "Tesla FSD News, Software Updates, Release Notes and Statistics"
        )
      ).toBe("source_hub");
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://example.com/autopilot",
          "Tesla FSD News, Reviews, Videos - Tesla Oracle"
        )
      ).toBe("source_hub");
    });

    it("should classify concrete reporting articles as story", () => {
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://www.teslaoracle.com/2026/08/31/unsupervised-tesla-cybercabs-roam-the-streets-of-austin-ahead-of-launch-videos/"
        )
      ).toBe("story");
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://www.autopilotreview.com/tesla-fsd-v14-3-8-and-v14-1-lite-rolling-out/"
        )
      ).toBe("story");
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://notateslaapp.com/news/4631/elon-musk-says-tesla-pothole-avoidance-is-coming"
        )
      ).toBe("story");
      expect(
        StoryDiscoveryEngine.classifyWebResource(
          "https://news.google.com/rss/articles/CBMivwFBVV95cUxQY3J6SlhLTEtVWFg0bTFYNF9sN0R0TmJrUGNwMk1RZUw0aXZZZkVmN0FIeWR1dklTWlJadmlkVGlObEF4dkhYWURWT09pSHpvVGh3aTk4TWRHdEwxUnBWTVE0WksxdUVWVHdGbmFQNXJXMXNyU0FuTjJTeXloN3ZRa0Rjem5CalNFampjNGs0U256aVZ0dWg0MTVTb1ZLTE9HdkQzZUtadkN1a3R4ZmpydEpvbGtaTjhNajk0a3RFWQ"
        )
      ).toBe("story");
    });
  });

  describe("searchRefreshedTopicData integration", () => {
    it("should use source hubs for discovery and populate refreshedCards strictly with genuine stories", async () => {
      // Mock Google News RSS returning an authentic news story
      vi.spyOn(FreeNewsFetcher, "fetchRssForQuery").mockResolvedValue([
        {
          source_url: "https://www.reuters.com/technology/autonomous-vehicles-safety-report-2026",
          source_name: "Reuters",
          title: "Autonomous Vehicles Safety Benchmark Published for 2026",
          raw_text: "Federal safety regulators released a comprehensive comparative benchmark evaluating self-driving intervention frequency.",
          author_bias_rating: "center",
          published_at: new Date().toISOString(),
          topic_category: "Autonomous Vehicles",
        },
      ]);

      // Mock LiveSearchEngine returning a mixture of a source hub and a story
      vi.spyOn(LiveSearchEngine, "search").mockResolvedValue([
        {
          source_url: "https://notateslaapp.com/fsd-beta/",
          source_name: "notateslaapp.com",
          title: "Tesla FSD News, Software Updates, Release Notes and Statistics",
          raw_text: "Latest news and updates catalog.",
          author_bias_rating: "center",
          published_at: new Date().toISOString(),
          topic_category: "Autonomous Vehicles",
        },
        {
          source_url: "https://autopilotreview.com/tesla-fsd-v14-3-8-and-v14-1-lite-rolling-out/",
          source_name: "autopilotreview.com",
          title: "Tesla FSD v14.3.8 and v14.1 Lite Rolling Out - AutoPilot Review",
          raw_text: "Tesla has begun rolling out Full Self-Driving v14.3.8 to customer fleet.",
          author_bias_rating: "center",
          published_at: new Date().toISOString(),
          topic_category: "Autonomous Vehicles",
        },
      ]);

      // Mock StoryDiscoveryEngine.discoverStoriesFromSource to return a concrete story from the hub
      vi.spyOn(StoryDiscoveryEngine, "discoverStoriesFromSource").mockResolvedValue([
        {
          source_url: "https://notateslaapp.com/news/4631/elon-musk-says-tesla-pothole-avoidance-is-coming",
          source_name: "notateslaapp.com",
          title: "Elon Musk Says Tesla Pothole Avoidance Is Coming to FSD",
          raw_text: "Tesla CEO confirmed that road hazard and pothole avoidance neural nets will deploy in an upcoming release.",
          author_bias_rating: "center",
          published_at: new Date().toISOString(),
          topic_category: "Autonomous Vehicles",
        },
      ]);

      const result = await TopicCardEvolutionOrchestrator.searchRefreshedTopicData("Autonomous Vehicles");

      // Verify refreshedCards has ONLY stories, NO source hubs
      expect(result.refreshedCards.length).toBeGreaterThanOrEqual(3);
      for (const card of result.refreshedCards) {
        expect(card.headline).not.toContain("News, Software Updates, Release Notes and Statistics");
        expect(card.headline).not.toBe("Tesla FSD News, Software Updates, Release Notes and Statistics");
      }

      // Verify the hub was retained in refreshedSources for attribution/provenance
      const hubInSources = result.refreshedSources.some((s) => s.url.includes("fsd-beta"));
      expect(hubInSources).toBe(true);

      // Verify discovered story from hub is present in refreshedCards
      const discoveredCard = result.refreshedCards.find((c) =>
        c.headline.includes("Pothole Avoidance")
      );
      expect(discoveredCard).toBeDefined();
      expect(discoveredCard?.summary).toContain("hazard and pothole avoidance");
    });
  });
});
