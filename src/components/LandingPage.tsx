"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  Layers,
  MessageSquareQuote,
  Compass,
  Cpu,
  Eye,
  Sliders,
  Flame,
  Globe2,
  Lock,
  CreditCard,
  Check,
  Terminal,
  Briefcase,
  BookOpen,
  HeartPulse,
  Scale,
  LifeBuoy,
} from "lucide-react";
import {
  trackLandingCta,
  trackFaqToggle,
  trackAuthAction,
} from "@/lib/analytics";

interface LandingPageProps {
  onSignIn: () => void;
  onExploreGuest: () => void;
}

export default function LandingPage({ onSignIn, onExploreGuest }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [interactiveTab, setInteractiveTab] = useState<"after" | "before">("after");

  const toggleFaq = (index: number) => {
    const isOpening = openFaq !== index;
    setOpenFaq(isOpening ? index : null);
    if (faqs[index]) {
      trackFaqToggle(faqs[index].q, isOpening ? "open" : "close");
    }
  };

  const faqs = [
    {
      q: "What makes Aletheia different from typical news apps?",
      a: "Most news feeds are optimized for outrage and emotional reactions to keep you scrolling. Aletheia focuses on clarity: an AI reads stories from trusted global wires, strips away sensational adjectives and emotional spin, and presents just the clear, verified facts.",
    },
    {
      q: "How does pricing work?",
      a: "Aletheia offers a generous Free Basic tier with standard AI epistemic companion allowance, zero ads, and zero data tracking. For power readers and deep research, our Subscriber membership is $15/month (with $10 off your first month—just $5 to start!), providing 6x higher companion capacity, priority live wire retrieval, and unconstrained dialogue.",
    },
    {
      q: "How does the AI reading partner work?",
      a: "Whenever you read a story, you can ask Aletheia anything. Wondering how a new scientific discovery works? Want a simple timeline of an ongoing world event? Ask in plain words, and your companion explains it clearly with citations.",
    },
    {
      q: "Do you sell my data or track my reading?",
      a: "No. Your interests and conversations are kept private to your account so the system knows what news to find for you. We never sell your personal data to brokers or third parties.",
    },
    {
      q: "Can I try it before signing in?",
      a: "Absolutely! You can click 'Explore Live Preview' right now to browse current news stories as a guest without creating an account.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 selection:bg-cyan-500 selection:text-black flex flex-col font-sans overflow-x-hidden">
      {/* Top Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-cyan-500/15 via-indigo-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[40%] -left-32 w-[500px] h-[500px] bg-violet-600/10 blur-3xl opacity-50" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-emerald-500/10 blur-3xl opacity-40" />
      </div>

      {/* Navigation Bar */}
      <header className="relative z-20 border-b border-white/10 backdrop-blur-xl bg-slate-950/70 sticky top-0 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-lg shadow-lg shadow-cyan-500/20">
            α
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">ALETHEIA</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-medium">
                News Without Noise
              </span>
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
          <a
            href="#perspectives"
            onClick={() => trackLandingCta("Nav Perspectives", "header")}
            className="hover:text-cyan-300 transition"
          >
            Who It&apos;s For
          </a>
          <a
            href="#how-it-works"
            onClick={() => trackLandingCta("Nav How It Works", "header")}
            className="hover:text-cyan-300 transition"
          >
            How It Works
          </a>
          <a
            href="#features"
            onClick={() => trackLandingCta("Nav Features", "header")}
            className="hover:text-cyan-300 transition"
          >
            Features
          </a>
          <a
            href="#comparison"
            onClick={() => trackLandingCta("Nav Why Aletheia", "header")}
            className="hover:text-cyan-300 transition"
          >
            Why Aletheia
          </a>
          <a
            href="#pricing"
            onClick={() => trackLandingCta("Nav Pricing", "header")}
            className="hover:text-cyan-300 transition"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={() => trackLandingCta("Nav FAQ", "header")}
            className="hover:text-cyan-300 transition"
          >
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              trackAuthAction("guest_explore_start", "header_nav");
              onExploreGuest();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
          >
            Explore Live Preview
          </button>
          <button
            onClick={() => {
              trackAuthAction("sign_in_initiated", "header_nav");
              onSignIn();
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition transform active:scale-95"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-medium mb-6 shadow-sm shadow-cyan-500/10">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>A brand new way to understand what's happening in the world</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
            News without the noise.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400">
              Clear facts without the drama.
            </span>
          </h1>

          {/* Subtitle in plain, human language */}
          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Tired of sensational headlines, clickbait, and endless scrolling? Aletheia strips away the emotional exaggeration,
            gives you honest bullet points, and pairs you with an AI companion ready to answer any question.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started with Google", "hero");
                trackAuthAction("sign_in_initiated", "hero");
                onSignIn();
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 transition transform active:scale-95"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Get Started with Google</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>

            <button
              onClick={() => {
                trackLandingCta("Explore Live Preview", "hero");
                trackAuthAction("guest_explore_start", "hero");
                onExploreGuest();
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition"
            >
              <Eye className="w-4 h-4 text-cyan-400" />
              <span>Explore Live Preview</span>
            </button>
          </div>

          {/* Trust Value Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Free Tier Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero Clickbait</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Direct Verified Citations</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Privacy First</span>
            </div>
          </div>

          {/* Hero Visual Display */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-white/15 bg-slate-900/50 shadow-2xl shadow-cyan-500/10 group relative">
              <img
                src="/images/landing/hero-showcase.jpg"
                alt="Aletheia Prism turning chaotic news into verified factual intelligence"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-500/30">
                    The Aletheia Difference
                  </span>
                  <h3 className="text-sm sm:text-lg font-bold text-white mt-1.5">
                    Chaotic Headlines In → Clear, Verified Facts Out
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5 line-clamp-2 sm:line-clamp-none">
                    Every article passes through an intelligent lens that removes bias, extracts the core timeline, and connects related stories so you always see the whole truth.
                  </p>
                </div>
                <button
                  onClick={() => {
                    trackLandingCta("Experience it now", "hero_showcase");
                    trackAuthAction("sign_in_initiated", "hero_showcase");
                    onSignIn();
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition"
                >
                  <span>Experience it now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Tailored Perspectives Showcase */}
        <section id="perspectives" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>One Engine • Tailored Workflows</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              One Unified Platform. Tailored to How You Think.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2">
              There is only one Aletheia — but whether you build models, allocate capital, research history, or protect your peace, see how our interface adapts to your focus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {/* 1. Tech */}
            <Link
              href="/tech"
              className="group rounded-2xl p-5 bg-slate-900/60 border border-cyan-500/30 hover:border-cyan-400/80 transition-all duration-300 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-cyan-500/10"
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden aspect-video border border-white/10 bg-slate-950">
                  <img
                    src="/images/landing/personas/tech-hero.jpg"
                    alt="Aletheia for Engineers and AI Researchers"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-cyan-400 font-bold flex items-center gap-1.5">
                    <Terminal className="w-4 h-4" />
                    Engineers & AI
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                    Zero PR Hype
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                  Raw Signal & Architecture
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ArXiv preprints, direct GitHub commit grounding, and technical telemetry stripped of corporate marketing buzzwords.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300 group-hover:translate-x-1 transition">
                <span>Explore for Engineers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 2. Business */}
            <Link
              href="/business"
              className="group rounded-2xl p-5 bg-slate-900/60 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-300 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-amber-500/10"
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden aspect-video border border-white/10 bg-slate-950">
                  <img
                    src="/images/landing/personas/business-hero.jpg"
                    alt="Aletheia for Executives and Investors"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4" />
                    Executives & VCs
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
                    Strategic Alpha
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition">
                  90-Second Decision Dossiers
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Macroeconomic consequence modeling, regulatory risk quantification, and spoken audio synthesis that saves 250+ hours yearly.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 group-hover:translate-x-1 transition">
                <span>Explore for Executives</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 3. Scholar */}
            <Link
              href="/scholar"
              className="group rounded-2xl p-5 bg-slate-900/60 border border-violet-500/30 hover:border-violet-400/80 transition-all duration-300 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-violet-500/10"
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden aspect-video border border-white/10 bg-slate-950">
                  <img
                    src="/images/landing/personas/scholar-hero.jpg"
                    alt="Aletheia for Scholars and Academics"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-violet-400 font-bold flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    Scholars & Thinkers
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/40 font-mono">
                    Dialectic Rigor
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition">
                  Archival Provenance Trees
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Multi-wire citation trees, Hegelian dialectic synthesis, and chronological story memory that defies the amnesiac 24-hour churn.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300 group-hover:translate-x-1 transition">
                <span>Explore for Scholars</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 4. Wellness */}
            <Link
              href="/wellness"
              className="group rounded-2xl p-5 bg-slate-900/60 border border-teal-500/30 hover:border-teal-400/80 transition-all duration-300 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-teal-500/10"
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden aspect-video border border-white/10 bg-slate-950">
                  <img
                    src="/images/landing/personas/wellness-hero.jpg"
                    alt="Aletheia for Mindful Readers"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-teal-400 font-bold flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4" />
                    Mindful Readers
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-500/40 font-mono">
                    Calm Sanctuary
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition">
                  Doomscroll Detox Sanctuary
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Protect your nervous system with finite news cards, adjustable cognitive load, and zero adrenaline triggers.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-300 group-hover:translate-x-1 transition">
                <span>Explore for Mindful Readers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* 5. Policy */}
            <Link
              href="/policy"
              className="group rounded-2xl p-5 bg-slate-900/60 border border-orange-500/30 hover:border-orange-400/80 transition-all duration-300 flex flex-col justify-between space-y-4 hover:shadow-xl hover:shadow-orange-500/10"
            >
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden aspect-video border border-white/10 bg-slate-950">
                  <img
                    src="/images/landing/personas/policy-hero.jpg"
                    alt="Aletheia for Watchdogs and Press"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-orange-400 font-bold flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    Watchdogs & Press
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500/40 font-mono">
                    Bias Audit
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-orange-300 transition">
                  Discrepancy & Radar Engine
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cross-spectrum wire comparison, timeline flip-flop tracking, and unverified claim isolation for civic minds.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-300 group-hover:translate-x-1 transition">
                <span>Explore for Watchdogs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* Interactive Comparison Section: Typical News vs Aletheia */}
        <section id="comparison" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Side-By-Side Comparison</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">Why Reading News Feels Broken Today</h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2">
              See what happens when you swap sensational outrage-farming for calm, factual intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* The Old Broken Way */}
            <div className="rounded-2xl p-6 bg-rose-950/20 border border-rose-500/20 flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-rose-500/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-500" />
                    Traditional News Sites
                  </span>
                  <span className="text-[10px] text-rose-300/80 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                    Outrage Driven
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 space-y-2">
                  <div className="text-[10px] font-mono text-rose-400 uppercase font-bold tracking-wider">
                    BREAKING: PANIC AS PRICES SPIRAL! YOU WON'T BELIEVE WHAT OFFICIALS SAID!
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed italic">
                    "Experts warn of catastrophic fallout as tensions mount... Read on to uncover the shocking revelation that changes everything."
                  </p>
                  <div className="pt-2 flex items-center gap-2 text-[10px] text-rose-400/80">
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800">Distracting clutter</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800">Emotional clickbait</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800">Zero context</span>
                  </div>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span>Designed to keep you worried so you stay trapped in outrage cycles.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span>Hides important details behind vague, provocative headlines.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span>No way to ask questions or verify where the information came from.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* The Aletheia Way */}
            <div className="rounded-2xl p-6 bg-cyan-950/20 border border-cyan-500/30 flex flex-col justify-between relative shadow-xl shadow-cyan-500/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    The Aletheia Way
                  </span>
                  <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    Calm & Verified
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                      Economic Indicator Update • Neutral Fact Brief
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Grounded in 4 Wire Sources
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white">
                    Central Bank Adjusts Benchmark Rates by 0.25% Following Inflation Data
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li><strong className="text-white">What happened:</strong> Rates lowered slightly following steady 2.4% price index reports.</li>
                    <li><strong className="text-white">Why it matters:</strong> Mortgage and loan costs ease gradually for home buyers over coming months.</li>
                    <li><strong className="text-white">What's next:</strong> Next formal policy committee meeting scheduled for mid-quarter review.</li>
                  </ul>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Pure, neutral facts summarized in clear bullet points you can read in seconds.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Always cites original sources so you know exactly where facts originate.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Ask the AI companion any follow-up question to clarify any detail.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights with Generated Images */}
        <section id="features" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/5">
          <div className="text-center mb-14">
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-bold">Features Made for Humans</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">Everything You Need to Stay Smart and Calm</h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2">
              Three powerful tools working behind the scenes so you never waste another minute on fluff.
            </p>
          </div>

          <div className="space-y-16">
            {/* Feature 1: Pure Facts, Zero Drama */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-2 lg:order-1 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs font-semibold border border-cyan-500/30">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>The Fact Filter</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  Pure Facts, Zero Drama.
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  News writers often add emotional words to provoke reactions. Aletheia's intelligent reading filter automatically strips away dramatic exaggerations.
                </p>
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Clear 3-Pillar Breakdown:</strong> Read what happened, why it matters, and the timeline in under 30 seconds.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Verified Wire Sources:</strong> Direct cross-checks across multiple reputable news wires for truth and accuracy.</span>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 shadow-xl shadow-cyan-500/5">
                <img
                  src="/images/landing/fact-filter.jpg"
                  alt="Fact Filter scanning news articles to remove sensational claims"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Feature 2: Chat & Ask Any Question */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-1 rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 shadow-xl shadow-indigo-500/5">
                <img
                  src="/images/landing/ai-companion.jpg"
                  alt="Friendly AI companion having an intelligent dialogue"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="order-2 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/30">
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  <span>Interactive Companion</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  Chat with Your Stories. Ask Anything.
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Have you ever read a headline and thought: <em>"What does this actually mean for me?"</em> or <em>"Can someone explain this without jargon?"</em>
                </p>
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Explain Like I'm Five:</strong> Ask the companion to simplify complex topics like quantum computing or macroeconomics.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Deep Technical Dives:</strong> If you're an engineer or researcher, ask for technical specifications and deep papers.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3: Grows With Your Curiosities */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="order-2 lg:order-1 space-y-4 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Personalized Growth</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  A Feed That Truly Learns What You Love.
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Unlike traditional social media algorithms that trap you in addictive rabbit holes, Aletheia quietly observes which topics genuinely spark your curiosity and connects related stories over time.
                </p>
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Living Topic Memory:</strong> Follow how a science mission or legal case evolves week after week without missing key updates.</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span><strong>Private to Your Account:</strong> Your interests and chats stay yours. We never sell your personal data to brokers.</span>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-900/40 shadow-xl shadow-emerald-500/5">
                <img
                  src="/images/landing/curiosity-network.jpg"
                  alt="Knowledge network connecting topics like space, science, and technology"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works in 3 Simple Steps */}
        <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Simple by Design</span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">Get Started in Less Than 30 Seconds</h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto mt-2">
              No credit card required to start. Just clean, honest news.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 text-left space-y-3 relative hover:border-cyan-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono text-base">
                1
              </div>
              <h3 className="text-base font-bold text-white">Sign In with Google</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Connect securely in one click. No lengthy registration forms or password hassle.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 text-left space-y-3 relative hover:border-indigo-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold font-mono text-base">
                2
              </div>
              <h3 className="text-base font-bold text-white">Explore Your Clean Feed</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Read fact-checked summaries on science, tech, global events, and culture free from emotional spin.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 text-left space-y-3 relative hover:border-emerald-500/40 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold font-mono text-base">
                3
              </div>
              <h3 className="text-base font-bold text-white">Ask & Learn</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Chat with your AI companion to explore backstory, ask for explanations, and cultivate your curiosity.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing & Membership Plans */}
        <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-12 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
              TRANSPARENT, VALUE-ALIGNED PRICING
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Invest in Your Epistemic Diet, Not Outrage
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              No sponsored posts. No algorithmic rage-bait. Choose the plan that best fits your daily news discovery and research needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Free Basic Tier */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-white/10 hover:border-white/20 transition flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                    Basic Tier
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-mono">
                    Free Forever
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 font-mono">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Start reading bias-stripped news wires and learning with your personalized companion immediately.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-white/5">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Standard AI companion capacity</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Epistemically sanitized multi-source articles</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Mind-State personal topic tracking</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span>Verified fact extractions & source citations</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  trackLandingCta("Explore Live Preview Free", "pricing_free_tier");
                  trackAuthAction("guest_explore_start", "pricing");
                  onExploreGuest();
                }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-semibold border border-white/10 transition"
              >
                Explore Live Preview Free
              </button>
            </div>

            {/* Subscriber Tier */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-cyan-950/30 border-2 border-cyan-500/50 shadow-xl shadow-cyan-500/10 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm">
                First Month $10 Off Special
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Subscriber Tier</span>
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono font-semibold">
                    Most Popular
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-4xl font-extrabold text-white">$5</span>
                    <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                    <span className="text-xs text-slate-400">/ 1st month</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">
                    then $15/month · cancel anytime
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  For serious readers, analysts, and researchers requiring deep synthesis and extensive inquiry.
                </p>

                <ul className="space-y-2.5 text-xs text-slate-200 pt-4 border-t border-cyan-500/20">
                  <li className="flex items-center gap-2.5 font-medium text-cyan-200">
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>6x companion dialogue & research capacity</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Priority live wire research & search retrieval</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Unrestricted companion dialogue deep-dives</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Multi-tier thematic intersections & discovery</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => {
                  trackLandingCta("Subscribe with Stripe", "pricing_subscriber_tier");
                  trackAuthAction("sign_in_initiated", "pricing_subscriber");
                  onSignIn();
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 hover:from-cyan-400 hover:via-teal-300 hover:to-indigo-500 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition transform active:scale-95"
              >
                <CreditCard className="w-4 h-4" />
                <span>Subscribe with Stripe — $5 First Month</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">Frequently Asked Questions</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">Common Questions, Simple Answers</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-slate-900/50 overflow-hidden transition"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white hover:text-cyan-300 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                        isOpen ? "transform rotate-180 text-cyan-400" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Call to Action Banner */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-cyan-950/50 via-slate-900 to-indigo-950/50 border border-cyan-500/30 text-center relative overflow-hidden shadow-2xl shadow-cyan-500/10">
            <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
                Ready for news that respects your intelligence?
              </h2>
              <p className="text-sm sm:text-base text-slate-300">
                Join readers who have left sensationalist noise behind. Sign in with Google to activate your personalized companion.
              </p>
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <button
                  onClick={() => {
                    trackLandingCta("Sign In with Google", "bottom_banner");
                    trackAuthAction("sign_in_initiated", "bottom_banner");
                    onSignIn();
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:via-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/20 transition transform active:scale-95"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    trackLandingCta("Explore Live Preview First", "bottom_banner");
                    trackAuthAction("guest_explore_start", "bottom_banner");
                    onExploreGuest();
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-300 hover:text-white text-sm font-medium transition"
                >
                  Explore Live Preview First
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950 px-4 sm:px-8 py-10 text-center text-xs text-slate-400 space-y-6">
        {/* Persona Perspective Links */}
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-4 sm:gap-8 pb-6 border-b border-white/5 text-[11px]">
          <Link href="/tech" className="hover:text-cyan-400 transition flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>For Engineers & AI</span>
          </Link>
          <Link href="/business" className="hover:text-amber-400 transition flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>For Executives & VCs</span>
          </Link>
          <Link href="/scholar" className="hover:text-violet-400 transition flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-violet-400" />
            <span>For Scholars & Academics</span>
          </Link>
          <Link href="/wellness" className="hover:text-teal-400 transition flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
            <span>For Mindful Readers</span>
          </Link>
          <Link href="/policy" className="hover:text-orange-400 transition flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-orange-400" />
            <span>For Watchdogs & Press</span>
          </Link>
          <Link href="/support" className="hover:text-cyan-400 transition flex items-center gap-1.5">
            <LifeBuoy className="w-3.5 h-3.5 text-cyan-400" />
            <span>Support & Help</span>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-[11px]">
            α
          </div>
          <span className="font-mono font-bold text-white">ALETHEIA</span>
          <span className="text-slate-400">• Part of the ciclops.io ecosystem</span>
        </div>
        <p className="max-w-md mx-auto text-slate-400">
          Built to restore trust, clarity, and depth to human knowledge. Clean facts, zero clickbait, private by design.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3 text-[11px] text-slate-400">
          <span>© {new Date().getFullYear()} Aletheia. All rights reserved.</span>
          <span>•</span>
          <Link href="/support" className="text-cyan-400 hover:text-cyan-300 transition">
            Contact Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
