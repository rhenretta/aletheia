"use client";

import React from "react";
import {
  DynamicBriefSection,
  EventSourceArticle,
  SynthesizedEventCard,
} from "@/core/types/contracts";
import { isForwardLookingCatalyst } from "@/core/matching/topic-brief-synthesizer";
import {
  Scale,
  Activity,
  Clock,
  MessageSquare,
  Sparkles,
  Compass,
  ArrowUpRight,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface DynamicBriefSectionRendererProps {
  section: DynamicBriefSection;
  onOpenSource?: (source: EventSourceArticle, card?: SynthesizedEventCard) => void;
  onAskQuestion?: (question: string) => void;
  allSources?: EventSourceArticle[];
}

export const DynamicBriefSectionRenderer: React.FC<DynamicBriefSectionRendererProps> = ({
  section,
  onOpenSource,
  onAskQuestion,
  allSources,
}) => {
  const { section_type, title, subtitle, badge, content } = section;

  const resolveUrl = (sourceUrl?: string, sourceName?: string): string | undefined => {
    if (sourceUrl && sourceUrl !== "#") return sourceUrl;
    if (sourceName && allSources && allSources.length > 0) {
      const cleanName = sourceName.trim().toLowerCase();
      const match = allSources.find(
        (s) =>
          s.name &&
          (s.name.toLowerCase() === cleanName ||
            s.name.toLowerCase().includes(cleanName) ||
            cleanName.includes(s.name.toLowerCase()))
      );
      if (match?.url && match.url !== "#") return match.url;
    }
    return undefined;
  };

  // 1. Critical Tensions & Contested Claims
  if (section_type === "critical_tensions" && content.tensions && content.tensions.length > 0) {
    const validTensions = content.tensions.filter((t) => {
      if (!t.thesis || !t.antithesis) return false;
      const th = t.thesis.trim().toLowerCase();
      const anti = t.antithesis.trim().toLowerCase();
      // Drop useless placeholder text
      if (th === "the claim" || anti === "the pushback" || th === anti) return false;
      if (
        t.verified_evidence &&
        (t.verified_evidence.toLowerCase().includes("single-source") ||
          t.verified_evidence.toLowerCase().includes("only one source") ||
          t.verified_evidence.toLowerCase().includes("subjective definition proposed by a reddit user"))
      ) {
        return false;
      }
      return true;
    });

    if (validTensions.length === 0) return null;

    return (
      <div className="rounded-xl p-4 bg-gradient-to-br from-slate-900/90 via-rose-950/20 to-slate-900/90 border border-rose-500/30 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-950/80 border border-rose-500/40 text-rose-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="space-y-2.5 pt-1">
          {validTensions.map((t, idx) => {
            const url = resolveUrl(t.source_url, t.source);
            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-200 text-[11px] sm:text-xs">
                    {t.topic_tension}
                  </div>
                  {t.source && (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-0.5 flex-shrink-0"
                      >
                        <span>[{t.source}]</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">
                        [{t.source}]
                      </span>
                    )
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                      Reported Claim
                    </span>
                    <p className="text-slate-300 leading-snug">{t.thesis}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/20 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                      Counterpoint / Context
                    </span>
                    <p className="text-slate-300 leading-snug">{t.antithesis}</p>
                  </div>
                </div>
                {t.verified_evidence && !t.verified_evidence.toLowerCase().includes("single-source") && (
                  <div className="text-[11px] text-amber-300/90 pt-1 border-t border-white/5 flex items-start gap-1.5">
                    <span className="text-amber-400 font-semibold">Context:</span>
                    <span>{t.verified_evidence}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Telemetry & Quantitative Metrics
  if (section_type === "telemetry_metrics" && content.metrics && content.metrics.length > 0) {
    return (
      <div className="rounded-xl p-4 bg-slate-900/80 border border-cyan-500/30 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {content.metrics.map((m, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-slate-950/70 border border-white/5 space-y-1 flex flex-col justify-between"
            >
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate">
                {m.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-300">
                  {m.value}
                </span>
                {m.trend && (
                  <span className="text-[10px]">
                    {m.trend === "up" ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400 inline" />
                    ) : m.trend === "down" ? (
                      <TrendingDown className="w-3 h-3 text-rose-400 inline" />
                    ) : (
                      <Minus className="w-3 h-3 text-slate-500 inline" />
                    )}
                  </span>
                )}
              </div>
              {m.context && (
                <div className="text-[9px] text-slate-400 line-clamp-2 leading-tight">
                  {m.context}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. Real-World Chronology & Progression
  if (section_type === "real_world_chronology" && content.milestones && content.milestones.length > 0) {
    return (
      <div className="rounded-xl p-4 bg-slate-900/70 border border-white/10 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-slate-800 border border-white/10 text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          {content.milestones.map((m, idx) => {
            const url = resolveUrl(m.source_url, m.source_name);
            return (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 space-y-1.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-[9px] font-mono text-cyan-300">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/40 font-bold">
                    {m.time_label}
                  </span>
                  {m.source_name && (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline truncate max-w-[110px] inline-flex items-center gap-0.5"
                        title={m.source_name}
                      >
                        <span className="truncate">{m.source_name}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-70 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-400 truncate max-w-[90px]">{m.source_name}</span>
                    )
                  )}
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-slate-200 hover:text-cyan-300 line-clamp-2 leading-snug font-sans transition hover:underline"
                  >
                    {m.milestone}
                  </a>
                ) : (
                  <p className="text-xs text-slate-200 line-clamp-2 leading-snug font-sans">
                    {m.milestone}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 4. Community & Practitioner Pulse
  if (section_type === "community_pulse" && content.quotes && content.quotes.length > 0) {
    return (
      <div className="rounded-xl p-4 bg-slate-900/80 border border-white/10 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
          {content.quotes.map((q, idx) => {
            const url = resolveUrl(q.url, q.speaker_or_community);
            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-2 flex flex-col justify-between"
              >
                <p className="italic text-slate-200 text-xs leading-relaxed line-clamp-3">
                  &ldquo;{q.quote}&rdquo;
                </p>
                <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300 border-t border-white/5 pt-1.5">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-300 hover:text-indigo-200 hover:underline truncate max-w-[140px] inline-flex items-center gap-1"
                      title={q.speaker_or_community}
                    >
                      <span className="truncate">[{q.speaker_or_community}]</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-70 flex-shrink-0" />
                    </a>
                  ) : (
                    <span className="truncate max-w-[130px]">[{q.speaker_or_community}]</span>
                  )}
                  {q.platform && (
                    <span className="uppercase text-[9px] text-slate-500">{q.platform}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 5. Key Developments & Field Shifts
  if (section_type === "key_developments" && content.bullets && content.bullets.length > 0) {
    return (
      <div className="rounded-xl p-4 bg-slate-900/90 border border-white/10 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-950/80 border border-amber-500/40 text-amber-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="space-y-2 pt-1">
          {content.bullets.map((b, idx) => {
            const url = resolveUrl(b.source_url, b.source);
            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1 hover:border-cyan-500/30 transition group"
              >
                {b.title && (
                  <div className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition flex items-center justify-between gap-2">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline inline-flex items-center gap-1 text-slate-100 group-hover:text-cyan-300"
                      >
                        <span>{b.title}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 inline flex-shrink-0" />
                      </a>
                    ) : (
                      <span>{b.title}</span>
                    )}
                    {b.source && (
                      url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex-shrink-0 inline-flex items-center gap-0.5"
                        >
                          <span>[{b.source}]</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">
                          [{b.source}]
                        </span>
                      )
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-300 leading-relaxed">{b.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 6. Catalysts & Pending Decisions
  if (section_type === "catalysts_outlook" && content.catalysts && content.catalysts.length > 0) {
    const validCatalysts = content.catalysts.filter((c) =>
      isForwardLookingCatalyst(c.event, c.timeframe)
    );
    if (validCatalysts.length === 0) {
      return null;
    }

    return (
      <div className="rounded-xl p-4 bg-gradient-to-br from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {validCatalysts.map((c, idx) => {
            const url = resolveUrl(c.source_url, c.source);
            return (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950/80 border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300">
                  <span className="font-bold">{c.timeframe}</span>
                  {c.source && (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[9px] text-indigo-300 hover:text-indigo-200 hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>[{c.source}]</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-500">[{c.source}]</span>
                    )
                  )}
                </div>
                <div className="text-xs font-semibold text-slate-100">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-indigo-300 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{c.event}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                    </a>
                  ) : (
                    c.event
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{c.significance}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 7. Deep-Dive Inquiries (Interactive questions for companion chat)
  if (section_type === "deep_dive_inquiries" && content.inquiries && content.inquiries.length > 0) {
    return (
      <div className="rounded-xl p-4 bg-slate-900/60 border border-cyan-500/20 space-y-3 shadow-md">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">{title}</h4>
          </div>
          {badge && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[11px] text-slate-400 leading-snug">{subtitle}</p>}

        <div className="space-y-2 pt-1">
          {content.inquiries.map((inq, idx) => (
            <div
              key={idx}
              onClick={() => onAskQuestion && onAskQuestion(inq.question)}
              className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 hover:border-cyan-500/40 hover:bg-slate-950 transition cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="space-y-0.5">
                <p className="text-xs text-slate-200 group-hover:text-cyan-300 transition">
                  {inq.question}
                </p>
                {inq.angle && (
                  <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-white/5">
                    {inq.angle}
                  </span>
                )}
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 flex-shrink-0 transition transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback generic summary layout
  return (
    <div className="rounded-xl p-4 bg-slate-900/60 border border-white/5 space-y-2">
      <h4 className="text-xs font-bold text-white">{title}</h4>
      {content.summary && <p className="text-xs text-slate-300 leading-relaxed">{content.summary}</p>}
    </div>
  );
};
