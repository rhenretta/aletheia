import { DirectSource, RawArticle } from "../types/contracts";
import { DirectContentCrawler } from "./direct-crawler";

export interface SocialCrawlResult {
  source: DirectSource;
  articles: RawArticle[];
  etag?: string;
  lastModified?: string;
  errorMessage?: string;
}

export class SocialContentCrawler {
  private static readonly USER_AGENT = "AletheiaBot/1.0 (Autonomous Epistemic Intelligence; public research agent)";

  // In-memory cache to prevent pounding public social APIs under high traffic
  private static readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
  private static readonly cache = new Map<string, { timestamp: number; result: SocialCrawlResult }>();

  /**
   * Dispatches crawling based on the direct source's platform or source_type
   */
  public static async crawl(source: DirectSource, maxPosts: number = 8): Promise<SocialCrawlResult> {
    const cached = this.cache.get(source.url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    let result: SocialCrawlResult;

    if (source.source_type === "reddit_community" || source.platform === "reddit" || source.url.includes("reddit.com/r/")) {
      result = await this.crawlReddit(source, maxPosts);
    } else if (source.source_type === "bluesky_profile" || source.platform === "bluesky" || source.url.includes("bsky.app") || source.url.includes("public.api.bsky.app")) {
      result = await this.crawlBluesky(source, maxPosts);
    } else {
      // Fallback to RSS/Atom or direct WWW parser
      const genericRes = await DirectContentCrawler.crawl(source, maxPosts);
      result = {
        source,
        articles: genericRes.articles.map((a) => ({
          ...a,
          content_format: a.content_format || "social_post",
          platform: source.platform || "open_web",
        })),
        etag: genericRes.etag,
        lastModified: genericRes.lastModified,
        errorMessage: genericRes.errorMessage,
      };
    }

    if (result.articles.length > 0) {
      this.cache.set(source.url, { timestamp: Date.now(), result });
    }

    return result;
  }

  /**
   * Crawls a public Reddit community via public JSON (.json) endpoint
   */
  public static async crawlReddit(source: DirectSource, maxPosts: number = 8): Promise<SocialCrawlResult> {
    let jsonUrl = source.url;
    // Normalize subreddit URL to hot.json
    try {
      const u = new URL(source.url);
      const parts = u.pathname.split("/").filter(Boolean);
      const rIdx = parts.indexOf("r");
      if (rIdx !== -1 && parts[rIdx + 1]) {
        const sub = parts[rIdx + 1];
        jsonUrl = `https://www.reddit.com/r/${sub}/hot.json?limit=${Math.min(maxPosts + 5, 25)}`;
      } else if (!jsonUrl.endsWith(".json")) {
        jsonUrl = jsonUrl.replace(/\/+$/, "") + "/hot.json";
      }
    } catch {
      jsonUrl = source.url;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const headers: Record<string, string> = {
        "User-Agent": this.USER_AGENT,
        Accept: "application/json",
      };
      if (source.etag) headers["If-None-Match"] = source.etag;
      if (source.last_modified) headers["If-Modified-Since"] = source.last_modified;

      const response = await fetch(jsonUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 304) {
        const cached = this.cache.get(source.url);
        return cached?.result || { source, articles: [] };
      }

      if (!response.ok) {
        // Fallback to indexed live search for this subreddit & topic with strict recency
        try {
          const { LiveSearchEngine } = await import("./live-search-engine");
          let subQuery = "site:reddit.com";
          const subMatch = source.url.match(/\/r\/([^/]+)/);
          if (subMatch) subQuery += `/r/${subMatch[1]}`;
          const searchArticles = await LiveSearchEngine.search(`${subQuery} ${source.topic}`, {
            maxResults: maxPosts,
            timeWindow: "month",
            maxAgeDays: 60,
          });
          if (searchArticles.length > 0) {
            return {
              source,
              articles: searchArticles.map((a) => ({
                ...a,
                source_name: `Reddit (${subMatch ? `r/${subMatch[1]}` : "community"})`,
                content_format: "discussion_thread",
                platform: "reddit",
                topic_category: source.topic,
              })),
            };
          }
        } catch {}

        return {
          source,
          articles: [],
          errorMessage: `Reddit HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const children = data?.data?.children || [];
      const articles: RawArticle[] = [];
      const now = Date.now();
      const maxAgeMs = 60 * 24 * 60 * 60 * 1000; // 60 days cutoff

      for (const child of children) {
        const post = child?.data;
        if (!post) continue;
        // Ignore stickied megathreads
        if (post.stickied) continue;

        // Skip stale posts older than 60 days to prevent surfacing multi-year-old threads
        if (post.created_utc) {
          const postAgeMs = now - post.created_utc * 1000;
          if (postAgeMs > maxAgeMs) continue;
        }

        const title = String(post.title || "").trim();
        if (title.length < 5) continue;

        const selftext = String(post.selftext || "").trim();
        const permalink = post.permalink ? `https://www.reddit.com${post.permalink}` : source.url;
        const author = post.author ? `u/${post.author}` : "reddit_user";
        const score = post.score ?? 0;
        const numComments = post.num_comments ?? 0;

        let rawText = title;
        if (selftext) {
          rawText += `. ${selftext}`;
        } else {
          rawText += ` (Discussion on r/${post.subreddit || "reddit"} with ${numComments} comments, community score: ${score})`;
        }

        let publishedAt = new Date().toISOString();
        if (post.created_utc) {
          publishedAt = new Date(post.created_utc * 1000).toISOString();
        }

        articles.push({
          source_url: permalink,
          source_name: `Reddit (r/${post.subreddit || "community"})`,
          title,
          raw_text: rawText.slice(0, 1500),
          author,
          author_bias_rating: "center",
          published_at: publishedAt,
          topic_category: source.topic,
          content_format: "discussion_thread",
          platform: "reddit",
        });

        if (articles.length >= maxPosts) break;
      }

      return {
        source,
        articles,
        etag: response.headers.get("etag") || undefined,
        lastModified: response.headers.get("last-modified") || undefined,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        source,
        articles: [],
        errorMessage: `Reddit crawl error: ${err?.message || String(err)}`,
      };
    }
  }

  /**
   * Crawls an author profile or searches posts on Bluesky via official public AT Protocol XRPC
   */
  public static async crawlBluesky(source: DirectSource, maxPosts: number = 8): Promise<SocialCrawlResult> {
    let handle = source.metadata?.handle_or_identifier;
    if (!handle) {
      try {
        const u = new URL(source.url);
        const match = u.pathname.match(/\/profile\/([^/]+)/);
        if (match) handle = match[1];
      } catch {}
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      let endpoint: string;
      if (handle) {
        endpoint = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=${Math.min(maxPosts + 5, 25)}`;
      } else {
        endpoint = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(source.topic)}&limit=${Math.min(maxPosts + 5, 25)}`;
      }

      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Fallback to indexed live search for Bluesky practitioner commentary
        try {
          const { LiveSearchEngine } = await import("./live-search-engine");
          const searchArticles = await LiveSearchEngine.search(
            `site:bsky.app ${handle ? `@${handle}` : ""} ${source.topic}`,
            {
              maxResults: maxPosts,
              timeWindow: "month",
              maxAgeDays: 60,
            }
          );
          if (searchArticles.length > 0) {
            return {
              source,
              articles: searchArticles.map((a) => ({
                ...a,
                source_name: `Bluesky (${handle ? `@${handle}` : "practitioners"})`,
                content_format: "social_post",
                platform: "bluesky",
                topic_category: source.topic,
              })),
            };
          }
        } catch {}

        return {
          source,
          articles: [],
          errorMessage: `Bluesky XRPC HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();
      const feed = data?.feed || (data?.posts ? data.posts.map((p: any) => ({ post: p })) : []);
      const articles: RawArticle[] = [];
      const now = Date.now();
      const maxAgeMs = 60 * 24 * 60 * 60 * 1000;

      for (const item of feed) {
        const post = item?.post;
        if (!post) continue;

        const record = post.record;
        const text = String(record?.text || "").trim();
        if (text.length < 15) continue; // Skip short greetings or replies

        const authorHandle = post.author?.handle || handle || "practitioner";
        const authorName = post.author?.displayName || `@${authorHandle}`;
        const uri = post.uri || "";
        const rkey = uri.split("/").pop() || "";
        const postUrl = `https://bsky.app/profile/${authorHandle}/post/${rkey}`;

        // Extract first sentence as title
        const firstSentenceMatch = text.match(/^([^.!?\n]+[.!?]?)/);
        const title = firstSentenceMatch ? firstSentenceMatch[1].trim() : text.slice(0, 80);

        let publishedAt = new Date().toISOString();
        if (record?.createdAt) {
          const d = new Date(record.createdAt);
          if (!isNaN(d.getTime())) {
            publishedAt = d.toISOString();
            if (now - d.getTime() > maxAgeMs) continue; // Skip stale post
          }
        }

        articles.push({
          source_url: postUrl,
          source_name: `Bluesky (${authorName})`,
          title: title.length > 100 ? `${title.slice(0, 97)}...` : title,
          raw_text: text,
          author: authorName,
          author_bias_rating: "center",
          published_at: publishedAt,
          topic_category: source.topic,
          content_format: "social_post",
          platform: "bluesky",
        });

        if (articles.length >= maxPosts) break;
      }

      return {
        source,
        articles,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return {
        source,
        articles: [],
        errorMessage: `Bluesky crawl error: ${err?.message || String(err)}`,
      };
    }
  }
}
