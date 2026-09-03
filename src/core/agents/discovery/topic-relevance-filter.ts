import { RawArticle } from "../../types/contracts";
import { deepseekProvider } from "../../llm/deepseek-provider";

export interface RelevanceEvaluationResult {
  accepted: RawArticle[];
  rejected: Array<{ article: RawArticle; reason: string }>;
}

export class TopicRelevanceFilter {
  // Known commercial ticket/booking aggregators that produce non-news transactional listings
  private static readonly TRANSACTIONAL_DOMAINS = new Set([
    "expedia.com",
    "kayak.com",
    "booking.com",
    "skyscanner.com",
    "cheapflights.com",
    "priceline.com",
    "hopper.com",
    "tripadvisor.com",
    "orbitz.com",
    "travelocity.com",
    "hotwire.com",
    "cheapoair.com",
  ]);

  /**
   * Evaluates a batch of candidate articles for semantic relevance against their assigned topic.
   * Eliminates homonyms, acronym collisions (e.g., airport code FSD vs Full Self-Driving),
   * and transactional aggregator listings.
   */
  public static async filterArticles(
    articles: RawArticle[],
    fallbackTopic?: string
  ): Promise<RelevanceEvaluationResult> {
    const accepted: RawArticle[] = [];
    const rejected: Array<{ article: RawArticle; reason: string }> = [];

    if (!articles || articles.length === 0) {
      return { accepted, rejected };
    }

    // 1. Fast pre-filter: Reject transactional travel/booking aggregators and malformed content
    const candidatesForSemanticEval: Array<{ article: RawArticle; targetTopic: string }> = [];

    for (const article of articles) {
      const targetTopic = article.topic_category || fallbackTopic || "";

      // Check transactional domain
      try {
        const host = new URL(article.source_url).hostname.toLowerCase().replace(/^www\./, "");
        if (this.TRANSACTIONAL_DOMAINS.has(host)) {
          rejected.push({
            article,
            reason: `Transactional fare/booking aggregator listing (${host})`,
          });
          continue;
        }
      } catch {}

      // Fast semantic token check: If topic has specific context (e.g. "FSD 14 3 7 reception"),
      // an article with zero overlap beyond a single short acronym is highly suspect
      const topicTerms = targetTopic
        .toLowerCase()
        .split(/[\s,/-]+/)
        .filter(
          (t) =>
            t.length > 1 &&
            !["the", "and", "for", "with", "from", "that", "in", "on", "at", "to", "of"].includes(t)
        );

      if (topicTerms.length >= 2) {
        const fullContent = `${article.title} ${article.raw_text}`.toLowerCase();
        const matchedTerms = topicTerms.filter((term) => fullContent.includes(term));

        // If the article matches NO terms at all, reject it
        if (matchedTerms.length === 0) {
          rejected.push({
            article,
            reason: `Zero semantic overlap with topic "${targetTopic}"`,
          });
          continue;
        }

        // If the article matches ONLY a single short acronym (<=4 chars),
        // and discusses an unrelated domain (such as travel/airport codes), reject it
        if (matchedTerms.length === 1 && matchedTerms[0].length <= 4) {
          const travelTokens = ["airport", "airline", "flight", "flights", "fares", "airfare", "passengers"];
          const isTravelDomain = travelTokens.some((tok) => fullContent.includes(tok));
          const isTopicAboutTravel = topicTerms.some((t) => travelTokens.includes(t));

          if (isTravelDomain && !isTopicAboutTravel) {
            rejected.push({
              article,
              reason: `Acronym/homonym collision: content pertains to air travel/airport code rather than "${targetTopic}"`,
            });
            continue;
          }
        }
      }

      candidatesForSemanticEval.push({ article, targetTopic });
    }

    // 2. If DeepSeek is not configured, accept remaining candidates that passed heuristic checks
    if (!deepseekProvider.isConfigured() || candidatesForSemanticEval.length === 0) {
      for (const item of candidatesForSemanticEval) {
        accepted.push(item.article);
      }
      return { accepted, rejected };
    }

    // 3. LLM-Driven Epistemic Relevance Verification in Batches (up to 10 articles per batch)
    const BATCH_SIZE = 10;
    for (let i = 0; i < candidatesForSemanticEval.length; i += BATCH_SIZE) {
      const batch = candidatesForSemanticEval.slice(i, i + BATCH_SIZE);

      const itemsPrompt = batch
        .map(
          (b, idx) => `Item ${idx}:
- Topic Intended: "${b.targetTopic}"
- Article Title: "${b.article.title}"
- Publisher: "${b.article.source_name}"
- Excerpt: "${b.article.raw_text.slice(0, 300)}"`
        )
        .join("\n\n");

      const prompt = `You are an epistemic curator evaluating whether candidate news articles are genuinely relevant to their intended topic.

Evaluate each item strictly.
REJECT any item that is:
- An acronym or homonym collision (e.g., an airport code, financial ticker, or person's name that coincidentally shares letters with the topic).
- A commercial travel fare listing, e-commerce catalog, or general corporate announcement unrelated to the specific topic subject.
- Tangential noise with zero substantive bearing on the topic.

ACCEPT items that are genuinely about the conceptual topic (updates, reviews, empirical developments, analysis).

Evaluate these ${batch.length} items:
${itemsPrompt}

Output strict JSON array with ${batch.length} objects:
[
  {
    "index": number,
    "is_relevant": boolean,
    "reason": "Concise justification for acceptance or rejection"
  }
]`;

      try {
        const response = await deepseekProvider.generateCompletion(prompt, {
          temperature: 0.1,
          maxTokens: 1000,
        });

        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) {
            const evaluatedIndices = new Set<number>();

            for (const item of parsed) {
              const idx = typeof item.index === "number" ? item.index : -1;
              if (idx >= 0 && idx < batch.length) {
                evaluatedIndices.add(idx);
                if (item.is_relevant === false) {
                  rejected.push({
                    article: batch[idx].article,
                    reason: item.reason || `Deemed irrelevant to topic "${batch[idx].targetTopic}" by epistemic filter`,
                  });
                } else {
                  accepted.push(batch[idx].article);
                }
              }
            }

            // Any items not explicitly returned in the JSON fallback to acceptance if heuristics passed
            for (let j = 0; j < batch.length; j++) {
              if (!evaluatedIndices.has(j)) {
                accepted.push(batch[j].article);
              }
            }
            continue;
          }
        }
      } catch (err) {
        console.warn("TopicRelevanceFilter: LLM evaluation error, falling back to heuristic results:", err);
      }

      // Fallback: If LLM call or JSON parsing fails, retain candidates that passed heuristics
      for (const item of batch) {
        accepted.push(item.article);
      }
    }

    return { accepted, rejected };
  }
}
