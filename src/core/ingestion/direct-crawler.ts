import { DirectSource, RawArticle, DirectSourceStatus } from "../types/contracts";
import { FreeNewsFetcher } from "./rss-search";

export interface CrawlResult {
  articles: RawArticle[];
  status: DirectSourceStatus;
  notModified: boolean;
  etag?: string;
  lastModified?: string;
  errorMessage?: string;
}

export class DirectContentCrawler {
  private static readonly DEFAULT_TIMEOUT_MS = 5000;
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  /**
   * Crawls a direct source (RSS feed or canonical WWW page) respecting conditional HTTP headers
   */
  public static async crawl(
    source: DirectSource,
    maxArticles: number = 6
  ): Promise<CrawlResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "User-Agent": this.USER_AGENT,
        Accept: source.source_type === "rss_feed"
          ? "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
          : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      };

      if (source.etag) {
        headers["If-None-Match"] = source.etag;
      }
      if (source.last_modified) {
        headers["If-Modified-Since"] = source.last_modified;
      }

      const response = await fetch(source.url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 304 Not Modified: Cache is fresh, zero new bytes to process
      if (response.status === 304) {
        return {
          articles: [],
          status: "active",
          notModified: true,
          etag: source.etag,
          lastModified: source.last_modified,
        };
      }

      if (!response.ok) {
        return {
          articles: [],
          status: source.consecutive_failures >= 2 ? "failing" : "active",
          notModified: false,
          errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const newEtag = response.headers.get("etag") || undefined;
      const newLastModified = response.headers.get("last-modified") || undefined;
      const bodyText = await response.text();

      let articles: RawArticle[] = [];
      if (source.source_type === "rss_feed") {
        articles = this.parseFeedXml(bodyText, source, maxArticles);
      } else {
        articles = this.parseHtmlPage(bodyText, source);
      }

      return {
        articles,
        status: articles.length > 0 ? "active" : source.status,
        notModified: false,
        etag: newEtag,
        lastModified: newLastModified,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : String(err);
      return {
        articles: [],
        status: source.consecutive_failures >= 2 ? "failing" : "active",
        notModified: false,
        errorMessage: msg,
      };
    }
  }

  /**
   * Parses RSS 2.0 or Atom feed XML into structured RawArticle records
   */
  public static parseFeedXml(
    xml: string,
    source: DirectSource,
    maxArticles: number
  ): RawArticle[] {
    const articles: RawArticle[] = [];

    // Check for RSS 2.0 <item> blocks
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && articles.length < maxArticles) {
      const item = match[1];

      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(item);
      const linkMatch = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(item);
      const pubDateMatch =
        /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(item) ||
        /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i.exec(item);
      const descMatch =
        /<description[^>]*>([\s\S]*?)<\/description>/i.exec(item) ||
        /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i.exec(item);

      const title = titleMatch ? FreeNewsFetcher.cleanHtml(titleMatch[1]) : "";
      let sourceUrl = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim() : "";
      if (!sourceUrl.startsWith("http")) {
        sourceUrl = source.url;
      }

      let publishedAt = new Date().toISOString();
      if (pubDateMatch) {
        const d = new Date(pubDateMatch[1].trim());
        if (!isNaN(d.getTime())) publishedAt = d.toISOString();
      }

      const rawText = descMatch ? FreeNewsFetcher.cleanHtml(descMatch[1]) : "";

      if (title.length > 5) {
        articles.push({
          source_url: sourceUrl,
          source_name: source.publisher_name,
          title,
          raw_text: rawText ? `${title}. ${rawText}` : title,
          author_bias_rating: "center",
          published_at: publishedAt,
          topic_category: source.topic,
        });
      }
    }

    // Fallback: Atom <entry> blocks
    if (articles.length === 0) {
      const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
      let eMatch: RegExpExecArray | null;

      while ((eMatch = entryRegex.exec(xml)) !== null && articles.length < maxArticles) {
        const entry = eMatch[1];
        const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(entry);
        const linkMatch =
          /<link[^>]+href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i.exec(entry) ||
          /<link[^>]*>([\s\S]*?)<\/link>/i.exec(entry);
        const updatedMatch =
          /<updated[^>]*>([\s\S]*?)<\/updated>/i.exec(entry) ||
          /<published[^>]*>([\s\S]*?)<\/published>/i.exec(entry);
        const summaryMatch =
          /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(entry) ||
          /<content[^>]*>([\s\S]*?)<\/content>/i.exec(entry);

        const title = titleMatch ? FreeNewsFetcher.cleanHtml(titleMatch[1]) : "";
        let url = linkMatch ? linkMatch[1].trim() : source.url;
        if (!url.startsWith("http")) url = source.url;

        let publishedAt = new Date().toISOString();
        if (updatedMatch) {
          const d = new Date(updatedMatch[1].trim());
          if (!isNaN(d.getTime())) publishedAt = d.toISOString();
        }

        const rawText = summaryMatch ? FreeNewsFetcher.cleanHtml(summaryMatch[1]) : "";

        if (title.length > 5) {
          articles.push({
            source_url: url,
            source_name: source.publisher_name,
            title,
            raw_text: rawText ? `${title}. ${rawText}` : title,
            author_bias_rating: "center",
            published_at: publishedAt,
            topic_category: source.topic,
          });
        }
      }
    }

    return articles;
  }

  /**
   * Parses canonical direct WWW HTML page into structured RawArticle
   */
  public static parseHtmlPage(html: string, source: DirectSource): RawArticle[] {
    // Extract title: <meta property="og:title"> or <title>
    const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const tagTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const title = FreeNewsFetcher.cleanHtml(ogTitle?.[1] || tagTitle?.[1] || source.title);

    // Extract description: <meta property="og:description"> or <meta name="description">
    const ogDesc = /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const metaDesc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html);
    const desc = FreeNewsFetcher.cleanHtml(ogDesc?.[1] || metaDesc?.[1] || "");

    // Extract body text from <article> or <main> or first few substantive <p> tags
    const articleBlock =
      /<article[^>]*>([\s\S]*?)<\/article>/i.exec(html) ||
      /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html);

    let bodyText = "";
    if (articleBlock) {
      const pMatches = articleBlock[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
      bodyText = pMatches
        .map((p) => FreeNewsFetcher.cleanHtml(p))
        .filter((t) => t.length > 30)
        .slice(0, 8)
        .join(" ");
    }

    if (!bodyText) {
      const allParagraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
      bodyText = allParagraphs
        .map((p) => FreeNewsFetcher.cleanHtml(p))
        .filter((t) => t.length > 30)
        .slice(0, 5)
        .join(" ");
    }

    const combinedRaw = desc && bodyText
      ? `${title}. ${desc} ${bodyText}`
      : bodyText || desc || title;

    if (title.length < 5) return [];

    return [
      {
        source_url: source.url,
        source_name: source.publisher_name,
        title,
        raw_text: combinedRaw.slice(0, 3000),
        author_bias_rating: "center",
        published_at: new Date().toISOString(),
        topic_category: source.topic,
      },
    ];
  }
}
