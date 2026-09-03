import { RawArticle } from "../types/contracts";
import { FreeNewsFetcher } from "./rss-search";

export class LiveSearchEngine {
  private static searchCache: Map<string, { timestamp: number; articles: RawArticle[] }> = new Map();
  private static readonly CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes
  private static ddgCircuitBreakerUntil: number = 0;
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  /**
   * Cleans and decodes HTML text and entities
   */
  public static cleanText(input: string): string {
    if (!input) return "";
    return FreeNewsFetcher.cleanHtml(input);
  }

  /**
   * Executes live search for a given query, returning structured results with rich snippets.
   * Uses an in-memory TTL cache, multi-provider mesh (Bing RSS + DDG), and query relaxation.
   */
  public static async search(query: string, maxResults: number = 6): Promise<RawArticle[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim();
    const cacheKey = cleanQuery.toLowerCase().replace(/\s+/g, " ");

    // 1. Check in-memory TTL cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.articles.slice(0, maxResults);
    }

    // 2. Execute search across multi-provider mesh
    let articles = await this.executeSearch(cleanQuery, maxResults);

    // 3. Automatic Query Relaxation: if results < 2 and query contains over-constraining month/date tokens
    if (articles.length < 2) {
      const relaxedQuery = this.relaxQuery(cleanQuery);
      if (relaxedQuery !== cleanQuery) {
        const relaxedArticles = await this.executeSearch(relaxedQuery, maxResults);
        if (relaxedArticles.length > articles.length) {
          articles = relaxedArticles;
        }
      }
    }

    // 4. Save to cache
    if (articles.length > 0) {
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        articles,
      });

      // Maintain max cache size (LRU prune after 300 entries)
      if (this.searchCache.size > 300) {
        const oldestKey = this.searchCache.keys().next().value;
        if (oldestKey) this.searchCache.delete(oldestKey);
      }
    }

    return articles.slice(0, maxResults);
  }

  /**
   * Relaxes over-constrained temporal tokens (e.g. month names, conversational fillers)
   */
  public static relaxQuery(query: string): string {
    return query
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, "")
      .replace(/\b(202[4-9]|203[0-9])\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Internal search orchestrator: tries DDG first, then Bing RSS, then Google News RSS
   */
  private static async executeSearch(query: string, maxResults: number): Promise<RawArticle[]> {
    const combined: RawArticle[] = [];
    const seenUrls = new Set<string>();

    // 1. DuckDuckGo HTML search (organic web index with trackers, blogs, wikis)
    if (Date.now() > this.ddgCircuitBreakerUntil) {
      try {
        const ddgResults = await this.queryDuckDuckGoHtml(query, maxResults);
        for (const a of ddgResults) {
          if (!seenUrls.has(a.source_url)) {
            seenUrls.add(a.source_url);
            combined.push(a);
          }
        }
      } catch (err) {
        console.warn(`LiveSearchEngine: DDG search error for "${query}":`, err);
      }
    }

    if (combined.length >= maxResults) {
      return combined.slice(0, maxResults);
    }

    // 2. Bing RSS Web Search (structured RSS XML fallback with relevance checking)
    try {
      const bingArticles = await this.queryBingRss(query, maxResults);
      for (const a of bingArticles) {
        if (!seenUrls.has(a.source_url)) {
          seenUrls.add(a.source_url);
          combined.push(a);
        }
      }
    } catch (err) {
      console.warn(`LiveSearchEngine: Bing RSS search error for "${query}":`, err);
    }

    if (combined.length >= 2) {
      return combined.slice(0, maxResults);
    }

    // 3. Google News RSS fallback (for breaking news and technical journalism)
    try {
      const rssArticles = await FreeNewsFetcher.fetchRssForQuery(query);
      for (const a of rssArticles) {
        if (!seenUrls.has(a.source_url)) {
          seenUrls.add(a.source_url);
          combined.push(a);
        }
      }
    } catch (err) {
      console.warn(`LiveSearchEngine: Google News RSS fallback error for "${query}":`, err);
    }

    return combined.slice(0, maxResults);
  }

  /**
   * Queries Bing Web Search RSS feed for general web documentation, release trackers, and forums
   */
  public static async queryBingRss(query: string, maxResults: number): Promise<RawArticle[]> {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent": this.USER_AGENT,
          Accept: "application/rss+xml, text/xml, */*",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) return [];

      const xml = await response.text();
      const articles: RawArticle[] = [];

      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match: RegExpExecArray | null;

      while ((match = itemRegex.exec(xml)) !== null && articles.length < maxResults) {
        const item = match[1];
        const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(item);
        const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(item);
        const descMatch = /<description>([\s\S]*?)<\/description>/i.exec(item);
        const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(item);

        const rawTitle = titleMatch ? this.cleanText(titleMatch[1]) : "";
        const url = linkMatch ? linkMatch[1].trim() : "";
        const snippet = descMatch ? this.cleanText(descMatch[1]) : "";

        if (url.startsWith("http") && rawTitle.length > 5) {
          try {
            const parsedUrl = new URL(url);
            const host = parsedUrl.hostname.toLowerCase();
            // Filter out e-commerce storefronts and checkout pages
            if (
              host.startsWith("shop.") ||
              host.startsWith("store.") ||
              host.startsWith("cart.") ||
              host.startsWith("checkout.")
            ) {
              continue;
            }
            // Filter out generic root homepages if they lack version/update context
            if (
              parsedUrl.pathname === "/" &&
              !rawTitle.toLowerCase().includes("version") &&
              !rawTitle.toLowerCase().includes("update") &&
              !rawTitle.toLowerCase().includes("release")
            ) {
              continue;
            }

            // Relevance verification: Result must match specific non-trivial query terms
            const nonTrivialTerms = query
              .toLowerCase()
              .split(/\s+/)
              .filter((t) => t.length > 2 && !["the", "and", "for", "with", "from", "that", "been", "how", "has"].includes(t));
            if (nonTrivialTerms.length > 1) {
              const fullSnippet = `${rawTitle} ${snippet}`.toLowerCase();
              const matchedCount = nonTrivialTerms.filter((term) => fullSnippet.includes(term)).length;
              if (matchedCount < Math.min(2, nonTrivialTerms.length)) {
                continue;
              }
            }
          } catch {}

          let sourceName = "Web Source";
          try {
            sourceName = new URL(url).hostname.replace(/^www\./, "");
          } catch {}

          let publishedAt = new Date().toISOString();
          if (pubDateMatch) {
            const d = new Date(pubDateMatch[1].trim());
            if (!isNaN(d.getTime())) publishedAt = d.toISOString();
          }

          articles.push({
            source_url: url,
            source_name: sourceName,
            title: rawTitle,
            raw_text: snippet ? `${rawTitle}. ${snippet}` : rawTitle,
            author_bias_rating: "center",
            published_at: publishedAt,
            topic_category: query,
          });
        }
      }

      return articles;
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Scrapes DuckDuckGo HTML search results for rich empirical snippets
   */
  private static async queryDuckDuckGoHtml(query: string, maxResults: number): Promise<RawArticle[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Status 202 is an anti-bot challenge: trip circuit breaker for 30 seconds
      if (response.status === 202 || !response.ok) {
        this.ddgCircuitBreakerUntil = Date.now() + 30 * 1000;
        return [];
      }

      const html = await response.text();
      // If the body is a challenge page without search results, trip circuit breaker
      if (html.includes("anomaly-modal") || !html.includes("result__a")) {
        this.ddgCircuitBreakerUntil = Date.now() + 30 * 1000;
        return [];
      }

      return this.parseDdgHtml(html, query, maxResults);
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  }

  /**
   * Parses DuckDuckGo HTML results extracting real publisher URLs, titles, and substantive snippets
   */
  private static parseDdgHtml(html: string, query: string, maxResults: number): RawArticle[] {
    const articles: RawArticle[] = [];

    const resultBlockRegex = /<div[^>]*class="[^"]*result\s+results_links[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*result\s+results_links|$)/gi;
    const blocks = html.match(resultBlockRegex) || [];

    for (const block of blocks) {
      if (articles.length >= maxResults) break;

      const titleMatch =
        /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(block);

      const snippetMatch =
        /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block) ||
        /<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block);

      if (titleMatch) {
        let rawUrl = titleMatch[1];
        if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl;

        if (rawUrl.includes("uddg=")) {
          const match = /uddg=([^&]+)/.exec(rawUrl);
          if (match) {
            try {
              rawUrl = decodeURIComponent(match[1]);
            } catch {}
          }
        }

        const title = this.cleanText(titleMatch[2]);
        const snippet = snippetMatch ? this.cleanText(snippetMatch[1]) : "";

        if (rawUrl.startsWith("http") && title.length > 5) {
          let sourceName = "Live Web Source";
          try {
            sourceName = new URL(rawUrl).hostname.replace(/^www\./, "");
          } catch {}

          articles.push({
            source_url: rawUrl,
            source_name: sourceName,
            title,
            raw_text: snippet ? `${title}. ${snippet}` : title,
            author_bias_rating: "center",
            published_at: new Date().toISOString(),
            topic_category: query,
          });
        }
      }
    }

    return articles;
  }
}
