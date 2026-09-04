"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Briefcase,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Play,
  Pause,
  ArrowRight,
  Eye,
  Sliders,
  Award,
  ChevronDown,
  Sparkles,
  BarChart3,
  Check,
  Building2,
  Globe2,
} from "lucide-react";
import PersonaNav from "./PersonaNav";
import PersonaFooter from "./PersonaFooter";
import { trackLandingCta, trackAuthAction } from "@/lib/analytics";

export default function BusinessLandingClient() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(32);
  const [weeklyHours, setWeeklyHours] = useState(7);
  const [executiveHourlyRate, setExecutiveHourlyRate] = useState(250);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Simulated audio playback progression
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  // Reclaimed executive focus metrics
  const annualHoursSaved = Math.round(weeklyHours * 0.75 * 50); // 75% noise eliminated across 50 work weeks
  const annualValueReclaimed = Math.round(annualHoursSaved * executiveHourlyRate);

  const faqs = [
    {
      q: "How does Aletheia preserve executive time?",
      a: "Typical news apps force executives to sift through 2,000-word articles laden with editorial speculation. Aletheia extracts the raw business facts into a 90-second executive dossier covering capital flows, regulatory exposure, and supply-chain impact.",
    },
    {
      q: "Can I track company-specific risks and geopolitical catalysts?",
      a: "Yes. Your personalized mind-state graph can track specific enterprise vendors, regulatory bodies (FTC, SEC, EU Commission), or macro commodities. The system alerts you to factual shifts without speculative clickbait.",
    },
    {
      q: "Is enterprise and board-level confidentiality protected?",
      a: "Strictly. Your reading history, inquiry prompts, and monitored topics are encrypted and never sold, shared with ad networks, or pooled into third-party training sets.",
    },
    {
      q: "Can this replace expensive enterprise market intelligence subscriptions?",
      a: "While Bloomberg or FactSet provide real-time ticker feeds, Aletheia solves the cognitive burden of reading and synthesizing global developments. It acts as an executive chief of staff that digests the world's news before it hits your desk.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070c10] text-slate-100 selection:bg-amber-400 selection:text-black flex flex-col font-sans overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-amber-500/15 via-emerald-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[500px] bg-amber-600/10 blur-3xl opacity-50" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-emerald-600/15 blur-3xl opacity-50" />
      </div>

      <PersonaNav currentPersona="business" accentColor="gold" />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono mb-6 shadow-sm shadow-amber-500/10">
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>ALETHEIA // EXECUTIVE & INVESTOR INTELLIGENCE</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
            Strategic alpha in 90 seconds.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-400">
              Macroeconomic clarity without the noise.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Your cognitive capital is your most expensive asset. Aletheia replaces sensationalized financial punditry with pure market signals, regulatory implications, and fiduciary facts.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started Business", "hero");
                trackAuthAction("sign_in_initiated", "business_hero");
                signIn("google", { callbackUrl: "/" });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-500 hover:from-amber-300 hover:to-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition transform active:scale-95"
            >
              <TrendingUp className="w-4 h-4 text-slate-950" />
              <span>Sign In with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>90-Second High-Density Dossiers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Fiduciary Impact Quantification</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>~250+ Hours Saved Annually</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Enterprise-Grade Privacy</span>
            </div>
          </div>

          {/* Hero Visual Display with Generated Media */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-amber-500/30 bg-slate-900/50 shadow-2xl shadow-amber-500/10 group relative">
              <img
                src="/images/landing/personas/business-hero.jpg"
                alt="Executive intelligence penthouse with macroeconomic holographic data and strategic clarity"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold bg-amber-950/90 px-2.5 py-1 rounded-md border border-amber-500/40">
                    Decision Telemetry
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-white mt-1.5">
                    Noise In → Fiduciary Alpha Out
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                    Cross-referencing central bank statements, trade filings, and SEC disclosures so you know the second-order consequences before markets price them in.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-amber-950/80 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-mono">
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Signal Index: 98.2%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Media Section: Executive 90-Second Brief Player */}
        <section id="interactive-media" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
              Interactive Media Demonstration
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">
              The 90-Second Executive Signal Brief
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2">
              Experience how Aletheia delivers high-density strategic briefings without sensational commentary.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/30 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Audio Waveform Player Simulation */}
            <div className="rounded-xl bg-slate-950/90 border border-amber-500/20 p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
              <button
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20 transition transform active:scale-95"
              >
                {isPlayingAudio ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <div className="flex-1 w-full space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Executive Morning Audio Synthesis: Global Supply Chain Rebalancing
                  </span>
                  <span className="font-mono text-amber-300">
                    0:{audioProgress < 10 ? `0${audioProgress}` : audioProgress} / 1:30
                  </span>
                </div>

                {/* Animated Waveform Bars */}
                <div className="h-8 flex items-end gap-1 overflow-hidden py-1 cursor-pointer" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  setAudioProgress(Math.round((clickX / rect.width) * 100));
                }}>
                  {Array.from({ length: 48 }).map((_, i) => {
                    const isActive = (i / 48) * 100 <= audioProgress;
                    const height = isPlayingAudio
                      ? Math.max(15, (Math.sin(i * 0.4 + audioProgress * 0.2) * 50 + 50))
                      : ((i % 5) * 15 + 20);
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-150 ${
                          isActive
                            ? "bg-gradient-to-t from-amber-500 to-yellow-300"
                            : "bg-slate-800 hover:bg-slate-700"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Fiduciary 3-Pillar Impact Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center justify-between">
                  <span>1. Capital Allocation</span>
                  <span className="text-emerald-400">+0.4% Yield</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Treasury spreads narrow following European Central Bank bond purchase updates. Short-duration corporate debt yields stabilize.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center justify-between">
                  <span>2. Regulatory Exposure</span>
                  <span className="text-amber-400">Moderate</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Draft maritime tariff adjustments pass subcommittee review. 90-day grace period anticipated for cross-border logistics contracts.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center justify-between">
                  <span>3. Supply Continuity</span>
                  <span className="text-emerald-400">Secured</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Semiconductor fab expansion in Dresden breaks ground on schedule. Equipment lead times project a 14-week drop by Q2.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Executive Focus ROI Calculator */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-6 sm:p-10 shadow-2xl">
            <div className="text-center mb-8">
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
                Executive Focus Calculator
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Calculate Your Reclaimed Time & Capital
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-2">
                Drag the sliders to calculate the annual executive value unlocked by replacing clickbait scrolling with synthesized dossiers.
              </p>
            </div>

            <div className="space-y-6 max-w-xl mx-auto text-left">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
                  <span>Hours Spent Scanning News & Feeds per Week</span>
                  <span className="text-amber-300 font-mono text-sm">{weeklyHours} hours/wk</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
                  <span>Your Effective Hourly Value / Focus Cost ($/hr)</span>
                  <span className="text-amber-300 font-mono text-sm">${executiveHourlyRate}/hr</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={executiveHourlyRate}
                  onChange={(e) => setExecutiveHourlyRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Calculated Results Banner */}
              <div className="p-5 rounded-2xl bg-black/50 border border-amber-500/40 grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-mono">Annual Focus Time Reclaimed</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono mt-1">
                    ~{annualHoursSaved} hrs
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Equivalent to 6 full work weeks</div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 uppercase font-mono">Executive Capital Unlocked</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono mt-1">
                    ${annualValueReclaimed.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Per executive user annually</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
              High-Fidelity Executive Membership
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              Invest in Decision Clarity
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-amber-950/40 border-2 border-amber-500/50 shadow-2xl shadow-amber-500/10 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-amber-400 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider">
              Executive Special: $10 Off Month 1
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-amber-300 font-semibold uppercase">Subscriber Tier</span>
                <div className="flex items-baseline gap-2 font-mono mt-1">
                  <span className="text-4xl font-extrabold text-white">$5</span>
                  <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                  <span className="text-xs text-slate-400">/ 1st month · then $15/mo</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackLandingCta("Subscribe Business", "pricing");
                  trackAuthAction("sign_in_initiated", "business_pricing");
                  signIn("google", { callbackUrl: "/" });
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-500 hover:from-amber-300 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition"
              >
                <span>Unlock Executive Access</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>6x inquiry capacity for strategic research</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Priority live wire retrieval across world desks</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Macroeconomic consequence modeling</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Private & confidential personal memory</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white hover:text-amber-300 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-amber-400" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <PersonaFooter />
    </div>
  );
}
