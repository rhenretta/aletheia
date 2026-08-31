"use client";

import React from "react";
import {
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Share2,
} from "lucide-react";
import { EventSourceArticle, SynthesizedEventCard } from "@/core/types/contracts";

interface SourceReaderModalProps {
  source: EventSourceArticle | null;
  card: SynthesizedEventCard | null;
  onClose: () => void;
  onDiscuss: (card: SynthesizedEventCard) => void;
}

function sanitizeText(input?: string): string {
  if (!input) return "";
  return input
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SourceReaderModal({
  source,
  card,
  onClose,
  onDiscuss,
}: SourceReaderModalProps) {
  if (!source) return null;

  const rawText = sanitizeText(source.raw_text) || "Full article text retrieved from wire feed.";
  const title = sanitizeText(source.title) || sanitizeText(source.name);
  const highlightedPassages = (source.highlighted_passages || []).map((p) => sanitizeText(p));

  // Break text into sentences for precision highlighting
  const sentences = rawText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  // Generate Chrome Text Fragment URL for exact browser scroll-to-text
  const primaryHighlight = highlightedPassages[0] || sentences[0] || "";
  const encodedTextFragment = primaryHighlight.length > 10
    ? `#:~:text=${encodeURIComponent(primaryHighlight.slice(0, 50))}`
    : "";
  const directArticleUrl = `${source.url}${encodedTextFragment}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl glass-panel rounded-2xl border border-white/20 shadow-2xl bg-slate-900/95 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white font-mono">{source.name}</span>
                <span className="px-2 py-0.5 rounded uppercase text-[10px] font-mono bg-slate-800 text-cyan-300 border border-white/10">
                  {source.bias.replace("_", " ")}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Original Reporting Ingested & Verified by Epistemology Agent
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={directArticleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <span>Open on Publisher Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Article Title */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white tracking-tight leading-snug">{title}</h2>
            {source.published_at && (
              <div className="text-xs text-slate-500 font-mono">
                Published: {new Date(source.published_at).toLocaleString()}
              </div>
            )}
          </div>

          {/* Passage Highlight Notice */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>
              Passages highlighted in <strong>cyan</strong> were verified across independent wires to construct the factual brief.
            </span>
          </div>

          {/* Article Content with Highlighted Passages */}
          <div className="p-5 rounded-xl bg-slate-950/80 border border-white/10 text-xs sm:text-sm leading-relaxed space-y-3 font-sans">
            {sentences.map((sentence, idx) => {
              const isHighlighted = highlightedPassages.some(
                (p) =>
                  p.toLowerCase().includes(sentence.slice(0, 30).toLowerCase()) ||
                  sentence.toLowerCase().includes(p.slice(0, 30).toLowerCase())
              );

              if (isHighlighted) {
                return (
                  <div
                    key={idx}
                    className="bg-cyan-500/15 border-l-4 border-cyan-400 pl-3 py-1.5 my-2 text-cyan-100 font-medium rounded-r-lg shadow-sm"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 uppercase font-bold mb-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Key Contributing Passage:
                    </div>
                    <span>{sentence}</span>
                  </div>
                );
              }

              return (
                <span key={idx} className="text-slate-300 pr-1">
                  {sentence}{" "}
                </span>
              );
            })}
          </div>

          {/* Extracted Epistemic Facts Sidebar */}
          {card && card.fact_bullets.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-white/10 space-y-2">
              <div className="text-xs font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                EXTRACTED EMPIRICAL FACTS GROUNDED IN THIS SOURCE:
              </div>
              <div className="space-y-1.5">
                {card.fact_bullets.map((bullet, i) => (
                  <div key={i} className="text-xs text-slate-200 p-2.5 rounded-lg bg-slate-950/60 border border-white/5">
                    {sanitizeText(bullet)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-400 font-mono">
            Source: <span className="text-slate-200">{source.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {card && (
              <button
                onClick={() => {
                  onDiscuss(card);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-2 hover:opacity-90 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Discuss This Article with Aletheia</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
