import { describe, it, expect, vi } from "vitest";
import { DirectContentCrawler } from "../core/ingestion/direct-crawler";
import { LiveSearchEngine } from "../core/ingestion/live-search-engine";
import { PostgresStore } from "../core/storage/postgres-store";
import { DirectSource } from "../core/types/contracts";

describe("Direct Source Architecture & Intelligent Crawler", () => {
  const store = PostgresStore.getInstance();

  it("parses RSS 2.0 feed XML into structured RawArticle records", () => {
    const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Tesla Software Update Tracker</title>
        <link>https://notateslaapp.com</link>
        <item>
          <title>Tesla FSD v14.3.8 Rolling Out</title>
          <link>https://notateslaapp.com/news/1234/tesla-fsd-v14-3-8</link>
          <description>Tesla has begun rolling out Full Self-Driving version 14.3.8 to customer vehicles with improved handling.</description>
          <pubDate>Thu, 03 Sep 2026 12:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`;

    const mockSource: DirectSource = {
      id: "src_test_1",
      topic: "Tesla FSD",
      source_type: "rss_feed",
      url: "https://notateslaapp.com/feed",
      title: "Tesla Software Update Tracker",
      publisher_name: "Not A Tesla App",
      status: "active",
      reliability_score: 1.0,
      consecutive_failures: 0,
      created_at: new Date().toISOString(),
    };

    const articles = DirectContentCrawler.parseFeedXml(mockRssXml, mockSource, 5);
    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("Tesla FSD v14.3.8 Rolling Out");
    expect(articles[0].source_name).toBe("Not A Tesla App");
    expect(articles[0].source_url).toBe("https://notateslaapp.com/news/1234/tesla-fsd-v14-3-8");
    expect(articles[0].raw_text).toContain("Full Self-Driving version 14.3.8");
  });

  it("parses Atom feed XML into structured RawArticle records", () => {
    const mockAtomXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Tesla Firmware Feeds</title>
      <entry>
        <title>2026.26.6.5 Release Notes</title>
        <link href="https://teslascope.com/software/2026.26.6.5" />
        <summary>Official changelog for FSD 14.3.8 containing safety optimizations.</summary>
        <updated>2026-09-02T18:00:00Z</updated>
      </entry>
    </feed>`;

    const mockSource: DirectSource = {
      id: "src_test_2",
      topic: "Tesla FSD",
      source_type: "rss_feed",
      url: "https://teslascope.com/feed.atom",
      title: "Tesla Firmware Feeds",
      publisher_name: "Teslascope",
      status: "active",
      reliability_score: 1.0,
      consecutive_failures: 0,
      created_at: new Date().toISOString(),
    };

    const articles = DirectContentCrawler.parseFeedXml(mockAtomXml, mockSource, 5);
    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("2026.26.6.5 Release Notes");
    expect(articles[0].source_url).toBe("https://teslascope.com/software/2026.26.6.5");
    expect(articles[0].raw_text).toContain("Official changelog for FSD 14.3.8");
  });

  it("parses canonical WWW HTML page into structured RawArticle", () => {
    const mockHtml = `<!DOCTYPE html>
    <html>
      <head>
        <title>Tesla Full Self-Driving Version History</title>
        <meta property="og:description" content="Complete tracker of all Tesla FSD releases from v12 through v14.3.8." />
      </head>
      <body>
        <main>
          <p>The current production release of Tesla FSD is version 14.3.8, deployed to Hardware 4 and Hardware 3 fleets.</p>
          <p>Early reception highlights smoother unprotected left turns and improved inclement weather navigation.</p>
        </main>
      </body>
    </html>`;

    const mockSource: DirectSource = {
      id: "src_test_3",
      topic: "Tesla FSD",
      source_type: "www_page",
      url: "https://autopilotreview.com/full-self-driving-update/",
      title: "Tesla FSD Updates",
      publisher_name: "AutoPilot Review",
      status: "active",
      reliability_score: 1.0,
      consecutive_failures: 0,
      created_at: new Date().toISOString(),
    };

    const articles = DirectContentCrawler.parseHtmlPage(mockHtml, mockSource);
    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("Tesla Full Self-Driving Version History");
    expect(articles[0].raw_text).toContain("v14.3.8");
    expect(articles[0].raw_text).toContain("unprotected left turns");
  });

  it("relaxes over-constrained temporal tokens from search queries", () => {
    const query = "Tesla FSD latest version reception September 2026";
    const relaxed = LiveSearchEngine.relaxQuery(query);
    expect(relaxed).toBe("Tesla FSD latest version reception");
    expect(relaxed).not.toContain("September");
    expect(relaxed).not.toContain("2026");
  });

  it("persists and retrieves direct sources via PostgresStore", async () => {
    const directSource: DirectSource = {
      id: "src_tesla_fsd_notateslaapp",
      topic: "Tesla FSD",
      source_type: "rss_feed",
      url: "https://www.notateslaapp.com/feed/test",
      title: "Not A Tesla App RSS",
      publisher_name: "Not A Tesla App",
      status: "active",
      reliability_score: 1.0,
      consecutive_failures: 0,
      created_at: new Date().toISOString(),
    };

    await store.saveDirectSource(directSource);
    const sources = await store.getDirectSourcesForTopic("Tesla FSD");

    expect(sources.length).toBeGreaterThan(0);
    const found = sources.find((s) => s.id === "src_tesla_fsd_notateslaapp");
    expect(found).toBeDefined();
    expect(found?.publisher_name).toBe("Not A Tesla App");
    expect(found?.status).toBe("active");

    // Test status update
    await store.updateDirectSourceStatus("src_tesla_fsd_notateslaapp", {
      lastCrawledAt: new Date().toISOString(),
      etag: '"test-etag-123"',
    });

    const updatedSources = await store.getDirectSourcesForTopic("Tesla FSD");
    const updated = updatedSources.find((s) => s.id === "src_tesla_fsd_notateslaapp");
    expect(updated?.etag).toBe('"test-etag-123"');
  });
});
