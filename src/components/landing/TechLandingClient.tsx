"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Terminal,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Code2,
  Flame,
  ArrowRight,
  Eye,
  GitBranch,
  Layers,
  ChevronDown,
  Sparkles,
  Zap,
  Activity,
  Check,
  Lock,
} from "lucide-react";
import PersonaNav from "./PersonaNav";
import PersonaFooter from "./PersonaFooter";
import { trackLandingCta, trackAuthAction } from "@/lib/analytics";

export default function TechLandingClient() {
  const [activeDiffTab, setActiveDiffTab] = useState<"reality" | "pr">("reality");
  const [terminalActive, setTerminalActive] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: "How does Aletheia distinguish between PR marketing and real engineering specs?",
      a: "Our multi-agent epistemic pipeline strips subjective sentiment, hyperbolic adjectives ('groundbreaking', 'miraculous', 'revolutionary'), and unsubstantiated claims. It cross-references technical announcements against public GitHub commits, ArXiv papers, and wire disclosures.",
    },
    {
      q: "Can I inspect the raw sources and citations?",
      a: "Yes. Every claim in the Aletheia feed is linked directly to its source wire article, arXiv preprint, or primary disclosure. You can open any story in the Source Reader or ask the companion for exact citations.",
    },
    {
      q: "What AI models power the verification companion?",
      a: "Aletheia utilizes Gemini 2.5 Flash and Gemini Pro with strict system grounding rules, zero conversational fluff, and epistemic guardrails designed to prevent hallucination.",
    },
    {
      q: "Does Aletheia have an API or developer tier?",
      a: "The Subscriber tier ($15/mo, $5 first month) provides high-capacity unconstrained inquiry. We are also rolling out webhooks and export capabilities for personal knowledge bases (Obsidian, Notion).",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 selection:bg-cyan-500 selection:text-black flex flex-col font-sans overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-cyan-500/20 via-blue-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[500px] bg-indigo-600/15 blur-3xl opacity-60" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-cyan-600/15 blur-3xl opacity-50" />
      </div>

      <PersonaNav currentPersona="tech" accentColor="cyan" />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-6 shadow-sm shadow-cyan-500/10">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>ALETHEIA FOR DEVELOPERS & RESEARCHERS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
            Raw signal. Zero PR spin.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
              Verified tech intelligence for builders.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Tired of corporate hype cycles, benchmark cherry-picking, and speculative AGI hysteria? Aletheia extracts pure architecture, factual parameters, and reproducible insights.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started Tech", "hero");
                trackAuthAction("sign_in_initiated", "tech_hero");
                signIn("google", { callbackUrl: "/" });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 hover:from-cyan-400 hover:via-teal-300 hover:to-indigo-500 text-slate-950 font-mono font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 transition transform active:scale-95"
            >
              <Zap className="w-4 h-4 text-slate-950" />
              <span>Sign In with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/?explore=true"
              onClick={() => {
                trackLandingCta("Explore Live Tech", "hero");
                trackAuthAction("guest_explore_start", "tech_hero");
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-mono text-sm flex items-center justify-center gap-2 transition"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Explore Live Preview</span>
            </Link>
          </div>

          {/* Metric Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>100% PR Spin Stripped</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Multi-Wire Cross Verification</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <span>Technical Benchmark Checks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Zero User Tracking</span>
            </div>
          </div>

          {/* Hero Visual Display with Generated Media */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-900/50 shadow-2xl shadow-cyan-500/15 group relative">
              <img
                src="/images/landing/personas/tech-hero.jpg"
                alt="AI engineers evaluating real telemetry and neural network architecture"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold bg-cyan-950/90 px-2.5 py-1 rounded-md border border-cyan-500/40">
                    Epistemic Neural Architecture
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-white mt-1.5 font-mono">
                    Telemetry In → Pure Parameter Truth Out
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                    Continuous scraping of global engineering wires, arXiv preprints, and hardware benchmarks—stripped of marketing fluff in real time.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Live Pipeline Active</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Media Section: PR Hype vs Engineering Reality */}
        <section id="interactive-media" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
              Interactive Media Demonstration
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-mono">
              PR Hype vs. Engineering Reality
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2">
              Toggle the switch below to see how Aletheia's epistemic lens filters exaggerated marketing press releases into verified technical truth.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
            {/* Interactive Toggle Pill */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={() => setActiveDiffTab("reality")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition flex items-center gap-2 ${
                  activeDiffTab === "reality"
                    ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Aletheia Engineering Reality</span>
              </button>
              <button
                onClick={() => setActiveDiffTab("pr")}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition flex items-center gap-2 ${
                  activeDiffTab === "pr"
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/25"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>Typical Tech Blog / PR Hype</span>
              </button>
            </div>

            {/* Display Card */}
            {activeDiffTab === "reality" ? (
              <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-5 space-y-4 font-mono text-left animate-in fade-in duration-300">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-bold text-cyan-300">
                      SYNTHESIZED_EVENT // LLM_EVALUATION
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span>Grounding: 99.4%</span>
                    <span>Hallucination: 0.00%</span>
                    <span>Wires: 4 Verified</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Transformer Optimization Yields 18% Latency Drop on A100 Benchmarks
                  </h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Disclosed via ArXiv:2409.1120 · PyTorch 2.4 kernel benchmark replication
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                    <strong className="text-cyan-300">Verified Architecture Change:</strong> Implements grouped query attention (GQA) with fused FlashAttention-3 kernels, reducing KV-cache memory bandwidth consumption from 420 GB/s to 345 GB/s.
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                    <strong className="text-cyan-300">Benchmark Limitations:</strong> Improvements measured strictly under batch size = 16. Degradation observed when sequence length exceeds 64k tokens due to cache spillover.
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                    <strong className="text-cyan-300">Source Footprint:</strong> Corroborated by independent test repo on GitHub (840+ stars), benchmarked on Ubuntu 24.04 CUDA 12.4.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 space-y-4 font-sans text-left animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
                  <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">
                    CLICKBAIT NEWSWIRE / SPONSORED PR
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800 font-mono">
                    HYPE SCORE: 98/100
                  </span>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-rose-200">
                    REVOLUTIONARY NEW AI CHIP SHATTERS ALL RECORDS! HUMAN LEVEL REASONING FINALLY UNLOCKED?!
                  </h3>
                  <div className="text-xs text-slate-400 mt-1 italic">
                    Published by TechTrendzDigest (Sponsored Partner Post)
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <p className="line-through text-slate-500">
                    "Experts are in shock as new breakthrough promises to replace all programmers by next week with astronomical 1000x improvements in brainpower."
                  </p>
                  <p className="text-rose-300 italic">
                    Notice the absence of specs, missing hardware baselines, hidden methodology, and pure adrenaline triggers designed to farm impressions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Technical Value Pillars */}
        <section id="value-pillars" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-bold">
              Architectural Values
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-mono">
              Engineered for Engineers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Code2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">ArXiv & Repo Grounding</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When a new model, framework, or vulnerability drops, Aletheia searches direct release notes, GitHub issues, and preprints rather than recycling speculative tweets.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Living Topic Memory</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Follow dynamic evolution across Rust concurrency, CUDA kernels, WebGPU, or quantum computing. Topics update seamlessly across days and weeks without amnesia.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Sub-Second Cognitive Ingestion</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Consume 50 pages of global technical wires in under 3 minutes with structured 3-point briefs: What shipped, reproducible performance delta, and downstream compatibility.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
              Transparent Developer Pricing
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
              High-Capacity Epistemic Intelligence
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-cyan-950/40 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/10 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider">
              Developer Special: $10 Off Month 1
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-cyan-300 font-semibold uppercase">Subscriber Tier</span>
                <div className="flex items-baseline gap-2 font-mono mt-1">
                  <span className="text-4xl font-extrabold text-white">$5</span>
                  <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                  <span className="text-xs text-slate-400">/ 1st month · then $15/mo</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackLandingCta("Subscribe Tech", "pricing");
                  trackAuthAction("sign_in_initiated", "tech_pricing");
                  signIn("google", { callbackUrl: "/" });
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition"
              >
                <span>Activate Technical Intelligence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>6x companion research capacity</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Priority global wire retrieval</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Unrestricted code & spec queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Zero telemetry selling or ads</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-mono">
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
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-mono font-semibold text-white hover:text-cyan-300 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-cyan-400" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3 font-sans">
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
