import { DirectSource, DirectSourceType, DirectSourceStatus } from "../../types/contracts";
import { postgresStore } from "../../storage/postgres-store";
import { DirectContentCrawler } from "../../ingestion/direct-crawler";
import { deepseekProvider } from "../../llm/deepseek-provider";
import { traceLogger } from "../../observability/trace-logger";

export interface ScoutCandidate {
  url: string;
  source_type: DirectSourceType;
  publisher_name: string;
  title: string;
}

export class DirectSourceScoutAgent {
  private static readonly USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  /**
   * Discovers, validates, and registers canonical direct RSS and WWW sources for a topic
   */
  public static async scoutForTopic(
    topic: string,
    maxSources: number = 4
  ): Promise<DirectSource[]> {
    const startTime = Date.now();
    const traceId = `trace_scout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Check existing direct sources for this topic
    const existing = await postgresStore.getDirectSourcesForTopic(topic);
    const activeExisting = existing.filter((s) => s.status === "active");
    if (activeExisting.length >= maxSources) {
      return activeExisting.slice(0, maxSources);
    }

    // 2. Generate candidate direct sources via LLM reasoning
    const candidates = await this.discoverCandidates(topic);

    // 3. Proactively discover RSS autodiscovery feeds from candidate WWW domains
    const expandedCandidates: ScoutCandidate[] = [];
    for (const cand of candidates) {
      expandedCandidates.push(cand);
      if (cand.source_type === "www_page") {
        const feedUrl = await this.detectRssLinkFromHtml(cand.url);
        if (feedUrl && !candidates.some((c) => c.url === feedUrl)) {
          expandedCandidates.push({
            url: feedUrl,
            source_type: "rss_feed",
            publisher_name: cand.publisher_name,
            title: `${cand.publisher_name} Direct Feed`,
          });
        }
      }
    }

    // 4. Validate each candidate by live probing
    const validatedSources: DirectSource[] = [];
    const validationErrors: Array<{ url: string; error: string }> = [];

    for (const cand of expandedCandidates) {
      if (validatedSources.length >= maxSources) break;

      const tempSource: DirectSource = {
        id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        topic,
        source_type: cand.source_type,
        url: cand.url,
        title: cand.title,
        publisher_name: cand.publisher_name,
        status: "pending_validation",
        reliability_score: 1.0,
        consecutive_failures: 0,
        created_at: new Date().toISOString(),
      };

      try {
        const result = await DirectContentCrawler.crawl(tempSource, 3);
        if (result.articles.length > 0 && result.status === "active") {
          tempSource.status = "active";
          tempSource.etag = result.etag;
          tempSource.last_modified = result.lastModified;
          tempSource.last_crawled_at = new Date().toISOString();
          tempSource.last_successful_content_at = new Date().toISOString();

          await postgresStore.saveDirectSource(tempSource);
          validatedSources.push(tempSource);
        } else {
          validationErrors.push({
            url: cand.url,
            error: result.errorMessage || "Zero valid items extracted",
          });
        }
      } catch (err) {
        validationErrors.push({
          url: cand.url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const latency = Date.now() - startTime;

    // Log structured trace for Observability
    traceLogger.logTrace({
      trace_id: traceId,
      session_id: `scout_${topic.replace(/\s+/g, "_")}`,
      timestamp: new Date().toISOString(),
      node_name: "node_scout",
      input_summary: {
        topic,
        candidates_evaluated: expandedCandidates.length,
      },
      output_summary: {
        sources_validated: validatedSources.length,
        active_source_urls: validatedSources.map((s) => s.url),
        failed_count: validationErrors.length,
      },
      reasoning_rationale: `Scout Agent probed ${expandedCandidates.length} candidate URLs for topic "${topic}". Successfully validated ${validatedSources.length} direct feeds.`,
      latency_ms: latency,
      metadata: {
        topic,
        validated_sources: validatedSources.map((s) => ({
          url: s.url,
          type: s.source_type,
          publisher: s.publisher_name,
        })),
        errors: validationErrors,
      },
    });

    return validatedSources;
  }

  /**
   * Generates candidate authoritative source URLs via domain-agnostic LLM reasoning
   */
  public static async discoverCandidates(topic: string): Promise<ScoutCandidate[]> {
    if (!deepseekProvider.isConfigured()) {
      return [];
    }

    const prompt = `Identify 3 to 5 authoritative, canonical direct sources for monitoring empirical developments, software release notes, and documentation for the topic: "${topic}".
Prefer official project/company blogs, dedicated update trackers, or direct RSS/Atom feeds where available.

Return strict JSON only (no markdown, no backticks):
[
  {
    "url": "https://example.com/feed or https://example.com/updates",
    "source_type": "rss_feed" or "www_page",
    "publisher_name": "Publisher Name",
    "title": "Descriptive Source Title"
  }
]`;

    try {
      const completion = await deepseekProvider.generateCompletion(prompt, {
        temperature: 0.1,
        maxTokens: 500,
      });

      const cleanJson = completion.text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c: any) => c && c.url && typeof c.url === "string" && c.url.startsWith("http"))
          .map((c: any) => ({
            url: c.url.trim(),
            source_type: c.source_type === "rss_feed" ? ("rss_feed" as DirectSourceType) : ("www_page" as DirectSourceType),
            publisher_name: String(c.publisher_name || new URL(c.url).hostname),
            title: String(c.title || c.publisher_name || topic),
          }));
      }
    } catch (err) {
      console.warn(`DirectSourceScoutAgent: Candidate discovery error for "${topic}":`, err);
    }

    return [];
  }

  /**
   * Inspects root HTML to automatically detect <link rel="alternate" type="application/rss+xml">
   */
  public static async detectRssLinkFromHtml(pageUrl: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch(pageUrl, {
        method: "GET",
        headers: { "User-Agent": this.USER_AGENT },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) return null;

      const html = await res.text();
      // Look in <head> for RSS / Atom link tags
      const linkMatch =
        /<link[^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]*>/i.exec(html) ||
        /<link[^>]+rel=["']alternate["'][^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/i.exec(html);

      if (linkMatch) {
        const hrefMatch = /href=["']([^"']+)["']/i.exec(linkMatch[0]);
        if (hrefMatch) {
          const rawHref = hrefMatch[1].trim();
          try {
            return new URL(rawHref, pageUrl).toString();
          } catch {
            return null;
          }
        }
      }
    } catch {
      clearTimeout(timeoutId);
    }

    return null;
  }
}
