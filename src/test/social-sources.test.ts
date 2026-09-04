import { describe, it, expect, vi, beforeEach } from "vitest";
import { SocialContentCrawler } from "../core/ingestion/social-crawler";
import { SocialSourceScoutAgent } from "../core/agents/scout/social-source-scout";
import { postgresStore } from "../core/storage/postgres-store";
import { DirectSource } from "../core/types/contracts";

describe("Social Media & Influencer Discovery Pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("SocialContentCrawler: Reddit Public Reader", () => {
    it("parses public Reddit JSON feed into structured RawArticle records", async () => {
      const mockRedditResponse = {
        data: {
          children: [
            {
              data: {
                title: "Tesla FSD v14.3.8 First Impressions and Real-World Testing",
                selftext: "Tested the new build on highway and local roads. Lane changes are noticeably smoother.",
                author: "tesladriver42",
                score: 342,
                num_comments: 89,
                permalink: "/r/teslamotors/comments/12345/fsd_v14_impressions/",
                created_utc: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
                subreddit: "teslamotors",
                stickied: false,
              },
            },
            {
              data: {
                title: "Weekly Megathread: General Discussion",
                selftext: "Please post general questions here.",
                author: "AutoModerator",
                score: 10,
                num_comments: 200,
                permalink: "/r/teslamotors/comments/sticky/",
                created_utc: Math.floor(Date.now() / 1000) - 3600,
                subreddit: "teslamotors",
                stickied: true, // Should be ignored
              },
            },
            {
              data: {
                title: "Old discussion from 2 years ago",
                selftext: "Old impressions.",
                author: "vintage_driver",
                score: 50,
                num_comments: 12,
                permalink: "/r/teslamotors/comments/ancient/",
                created_utc: Math.floor(Date.now() / 1000) - 120 * 24 * 3600, // 120 days ago (stale)
                subreddit: "teslamotors",
                stickied: false,
              },
            },
          ],
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRedditResponse,
        headers: new Headers({ etag: '"reddit-etag-1"' }),
      } as any);

      const source: DirectSource = {
        id: "src_reddit_test",
        topic: "Tesla FSD",
        source_type: "reddit_community",
        url: "https://www.reddit.com/r/teslamotors/",
        title: "r/teslamotors",
        publisher_name: "Reddit (r/teslamotors)",
        status: "active",
        reliability_score: 0.9,
        platform: "reddit",
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
      };

      const result = await SocialContentCrawler.crawlReddit(source, 5);

      expect(result.articles).toHaveLength(1);
      const article = result.articles[0];
      expect(article.title).toBe("Tesla FSD v14.3.8 First Impressions and Real-World Testing");
      expect(article.author).toBe("u/tesladriver42");
      expect(article.content_format).toBe("discussion_thread");
      expect(article.platform).toBe("reddit");
      expect(article.raw_text).toContain("Lane changes are noticeably smoother");
      expect(result.etag).toBe('"reddit-etag-1"');
    });
  });

  describe("SocialContentCrawler: Bluesky AT Protocol Reader", () => {
    it("parses public Bluesky AT Protocol XRPC posts into structured RawArticle records", async () => {
      const mockBlueskyResponse = {
        feed: [
          {
            post: {
              uri: "at://did:plc:123/app.bsky.feed.post/3kabcde",
              author: {
                handle: "autonomous-research.bsky.social",
                displayName: "Autonomous Systems Lab",
              },
              record: {
                text: "We just published our benchmark results comparing neural end-to-end planners across weather conditions. Full paper linked below.",
                createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
              },
            },
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockBlueskyResponse,
      } as any);

      const source: DirectSource = {
        id: "src_bsky_test",
        topic: "Autonomous Driving",
        source_type: "bluesky_profile",
        url: "https://bsky.app/profile/autonomous-research.bsky.social",
        title: "Autonomous Systems Lab on Bluesky",
        publisher_name: "Bluesky @autonomous-research.bsky.social",
        status: "active",
        reliability_score: 0.95,
        platform: "bluesky",
        metadata: {
          platform: "bluesky",
          handle_or_identifier: "autonomous-research.bsky.social",
        },
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
      };

      const result = await SocialContentCrawler.crawlBluesky(source, 5);

      expect(result.articles).toHaveLength(1);
      const article = result.articles[0];
      expect(article.title).toContain("We just published our benchmark results");
      expect(article.author).toBe("Autonomous Systems Lab");
      expect(article.content_format).toBe("social_post");
      expect(article.platform).toBe("bluesky");
      expect(article.source_url).toBe("https://bsky.app/profile/autonomous-research.bsky.social/post/3kabcde");
    });
  });

  describe("SocialSourceScoutAgent", () => {
    it("skips discovery if active social sources are already registered", async () => {
      const existingSources: DirectSource[] = [
        {
          id: "soc_1",
          topic: "Quantum Computing",
          source_type: "reddit_community",
          url: "https://www.reddit.com/r/QuantumComputing/",
          title: "r/QuantumComputing",
          publisher_name: "Reddit",
          status: "active",
          reliability_score: 0.9,
          platform: "reddit",
          consecutive_failures: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: "soc_2",
          topic: "Quantum Computing",
          source_type: "bluesky_profile",
          url: "https://bsky.app/profile/quantum.bsky.social",
          title: "Quantum Updates",
          publisher_name: "Bluesky",
          status: "active",
          reliability_score: 0.9,
          platform: "bluesky",
          consecutive_failures: 0,
          created_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(postgresStore, "getDirectSourcesForTopic").mockResolvedValueOnce(existingSources);

      const result = await SocialSourceScoutAgent.scoutForTopic("Quantum Computing");

      expect(result.sources_validated_and_saved).toHaveLength(2);
      expect(result.candidate_sources_found).toBe(2);
    });
  });

  describe("PostgresStore Social Metadata Persistence", () => {
    it("saves and retrieves direct sources with social metadata and platform", async () => {
      const socialSource: DirectSource = {
        id: "soc_meta_test",
        topic: "Neuroscience Tech",
        source_type: "bluesky_profile",
        url: "https://bsky.app/profile/neurotech.bsky.social",
        title: "Neurotech Hub",
        publisher_name: "Bluesky @neurotech",
        status: "active",
        reliability_score: 0.92,
        platform: "bluesky",
        metadata: {
          platform: "bluesky",
          handle_or_identifier: "neurotech.bsky.social",
          profile_name: "Neurotech Hub",
          role_description: "Leading Neuroengineering Research Community",
        },
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
      };

      await postgresStore.saveDirectSource(socialSource);
      const retrieved = await postgresStore.getDirectSourcesForTopic("Neuroscience Tech");

      const match = retrieved.find((s) => s.id === "soc_meta_test");
      expect(match).toBeDefined();
      expect(match?.platform).toBe("bluesky");
      expect(match?.metadata?.role_description).toBe("Leading Neuroengineering Research Community");
    });
  });
});
