import { describe, it, expect } from "vitest";
import { FreeNewsFetcher } from "../core/ingestion/rss-search";

describe("Free Multi-Source News Ingestion (Zero API Keys)", () => {
  it("fetches and parses live articles for a topic", async () => {
    const articles = await FreeNewsFetcher.searchNews("SpaceX Starship", 4);

    expect(articles).toBeDefined();
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0].title).toBeDefined();
    expect(articles[0].source_name).toBeDefined();
    expect(articles[0].source_url).toBeDefined();
    expect(articles[0].raw_text.length).toBeGreaterThan(10);
    expect(["lean_left", "center", "lean_right", "far_left", "far_right", "unknown"]).toContain(
      articles[0].author_bias_rating
    );
  });
});
