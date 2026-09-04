"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * Resilient link regex matching standard and LLM-deviant markdown links:
 * - Standard: [Label](https://url)
 * - Mismatched delimiter: [Label](https://url] or [Label][https://url)
 * - Double bracket: [Label][https://url]
 * - Whitespace: [Label] (https://url)
 */
const RESILIENT_LINK_REGEX = /\[([^\]]+)\]\s*[\(\[](https?:\/\/[^\s\)\]]+)[\)\]]/g;
const BOLD_REGEX = /\*\*([^*]+)\*\*/g;
const BARE_URL_REGEX = /(https?:\/\/[^\s<>'\"()\[\]]+)/g;

function renderTextWithBareUrls(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  BARE_URL_REGEX.lastIndex = 0;
  while ((match = BARE_URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }
    let url = match[1];
    let trailingPunct = "";
    const punctMatch = url.match(/([.,;:!?]+)$/);
    if (punctMatch) {
      trailingPunct = punctMatch[1];
      url = url.slice(0, -trailingPunct.length);
    }
    parts.push(
      <a
        key={`${keyPrefix}-bare-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-400 hover:text-cyan-200 underline underline-offset-2 font-medium inline-flex items-center gap-0.5 transition-colors mx-0.5 bg-cyan-950/50 hover:bg-cyan-900/70 px-1.5 py-0.5 rounded border border-cyan-500/30 max-w-full align-middle text-xs break-all"
        title={`Visit link: ${url}`}
      >
        <span className="truncate max-w-[280px]">{url}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-80 inline ml-0.5 flex-shrink-0" />
      </a>
    );
    if (trailingPunct) {
      parts.push(trailingPunct);
    }
    lastIdx = BARE_URL_REGEX.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts;
}

function renderBoldSegments(text: string, keyPrefix: string): React.ReactNode {
  const subParts: React.ReactNode[] = [];
  let lastIndex = 0;
  let bMatch: RegExpExecArray | null;

  BOLD_REGEX.lastIndex = 0;
  while ((bMatch = BOLD_REGEX.exec(text)) !== null) {
    if (bMatch.index > lastIndex) {
      const plain = text.substring(lastIndex, bMatch.index);
      subParts.push(...renderTextWithBareUrls(plain, `${keyPrefix}-p-${lastIndex}`));
    }
    subParts.push(
      <strong key={`${keyPrefix}-b-${bMatch.index}`} className="font-semibold text-white">
        {bMatch[1]}
      </strong>
    );
    lastIndex = BOLD_REGEX.lastIndex;
  }

  if (lastIndex < text.length) {
    const plain = text.substring(lastIndex);
    subParts.push(...renderTextWithBareUrls(plain, `${keyPrefix}-p-${lastIndex}`));
  }

  return <React.Fragment key={keyPrefix}>{subParts}</React.Fragment>;
}

export function renderFormattedMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  // Normalize orphan punctuation like " [link] ." -> " [link]."
  const normalizedContent = content.replace(/\s+([.,;:!?])/g, "$1");

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  RESILIENT_LINK_REGEX.lastIndex = 0;
  while ((match = RESILIENT_LINK_REGEX.exec(normalizedContent)) !== null) {
    if (match.index > lastIdx) {
      parts.push(renderBoldSegments(normalizedContent.substring(lastIdx, match.index), `txt-${lastIdx}`));
    }
    const label = match[1];
    let url = match[2];
    // Strip any accidental trailing punctuation inside the URL delimiter
    url = url.replace(/[.,;:!?]+$/, "");

    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan-400 hover:text-cyan-200 underline underline-offset-2 font-medium inline-flex items-center gap-0.5 transition-colors mx-0.5 bg-cyan-950/50 hover:bg-cyan-900/70 px-1.5 py-0.5 rounded border border-cyan-500/30 max-w-full align-middle text-xs"
        title={`Visit original source: ${url}`}
      >
        <span className="truncate max-w-[280px]">{label}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-80 inline ml-0.5 flex-shrink-0" />
      </a>
    );
    lastIdx = RESILIENT_LINK_REGEX.lastIndex;
  }

  if (lastIdx < normalizedContent.length) {
    parts.push(renderBoldSegments(normalizedContent.substring(lastIdx), `txt-${lastIdx}`));
  }

  return parts;
}

export function FormattedMessage({ content }: { content: string }) {
  return <>{renderFormattedMessageContent(content)}</>;
}
