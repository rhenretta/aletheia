"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  HeartPulse,
  Sun,
  Moon,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Eye,
  Sliders,
  Smile,
  Frown,
  ChevronDown,
  Check,
  Leaf,
  Coffee,
  Heart,
  Wind,
} from "lucide-react";
import PersonaNav from "./PersonaNav";
import PersonaFooter from "./PersonaFooter";
import { trackLandingCta, trackAuthAction } from "@/lib/analytics";

export default function WellnessLandingClient() {
  const [sanctuaryLevel, setSanctuaryLevel] = useState<number>(85); // 0 (Doomscroll) to 100 (Sanctuary)
  const [cognitiveLoad, setCognitiveLoad] = useState<"low" | "balanced" | "deep">("low");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const isHighSanctuary = sanctuaryLevel >= 50;

  const faqs = [
    {
      q: "How does Aletheia prevent doomscrolling?",
      a: "Traditional feeds use infinite scrolls, auto-playing videos, and red notification badges deliberately engineered to trigger panic and dopamine spikes. Aletheia provides a bounded, clean deck of calm factual points with an intentional finish line, giving you healthy closure instead of endless anxiety.",
    },
    {
      q: "What is Cognitive Load switching?",
      a: "On days when you feel exhausted or overwhelmed, you can switch Aletheia into 'Low Cognitive Load' mode. The system trims stories to 1-sentence summaries and gentle takeaways, letting you stay informed without taxing your nervous system.",
    },
    {
      q: "Does Aletheia hide important world events?",
      a: "Not at all. We cover all major global events, science breakthroughs, and policy shifts. However, we eliminate inflammatory language, apocalyptic clickbait, and panic-mongering so you learn what actually happened without emotional distress.",
    },
    {
      q: "Is there a bedtime or evening mode?",
      a: "Yes. The dark, uncluttered interface uses soft muted color palettes designed to minimize blue light strain and keep your heart rate steady before rest.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070e10] text-slate-100 selection:bg-teal-400 selection:text-black flex flex-col font-sans overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-teal-500/15 via-emerald-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[500px] bg-cyan-600/10 blur-3xl opacity-50" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-teal-600/15 blur-3xl opacity-50" />
      </div>

      <PersonaNav currentPersona="wellness" accentColor="teal" />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium mb-6 shadow-sm shadow-teal-500/10">
            <Leaf className="w-3.5 h-3.5 text-teal-400" />
            <span>ALETHEIA // MINDFUL READERS & DIGITAL WELLNESS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
            Stay informed without the anxiety.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-emerald-200 to-cyan-300">
              A peaceful sanctuary for your mind.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Break free from algorithmic outrage loops and adrenaline spikes. Experience clear, calm news designed to protect your nervous system and restore your daily peace.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started Wellness", "hero");
                trackAuthAction("sign_in_initiated", "wellness_hero");
                signIn("google", { callbackUrl: "/" });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-teal-500/20 transition transform active:scale-95"
            >
              <Heart className="w-4 h-4 fill-current text-slate-950" />
              <span>Begin Your Calm News Routine</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/?explore=true"
              onClick={() => {
                trackLandingCta("Explore Live Wellness", "hero");
                trackAuthAction("guest_explore_start", "wellness_hero");
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition"
            >
              <Eye className="w-4 h-4 text-teal-400" />
              <span>Explore Live Preview</span>
            </Link>
          </div>

          {/* Metric Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>Zero Panic Clickbait</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span>Finite Feed with Natural Closure</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span>Calm Breathing & Reading Pace</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Gentle Morning & Evening Digests</span>
            </div>
          </div>

          {/* Hero Visual Display with Generated Media */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-teal-500/30 bg-slate-900/50 shadow-2xl shadow-teal-500/10 group relative">
              <img
                src="/images/landing/personas/wellness-hero.jpg"
                alt="Mindful person peacefully enjoying tea at dawn overlooking misty mountains with a calm news reader"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-teal-300 font-semibold bg-teal-950/90 px-2.5 py-1 rounded-md border border-teal-500/40">
                    Calm Technology
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-white mt-1.5">
                    Your Attention is Sacred. We Protect It.
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5">
                    Designed to leave you feeling grounded, enlightened, and serene—never frantic, agitated, or drained.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-teal-950/80 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
                    <span>Heart Rate: Steady & Rested</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Media Section: Doomscroll Detox Slider */}
        <section id="interactive-media" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-teal-400 font-bold">
              Interactive Media Demonstration
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">
              Doomscroll vs. Sanctuary Experience
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2">
              Drag the detox slider below to feel the difference between an adrenaline-fueled outrage feed and Aletheia's calm factual sanctuary.
            </p>
          </div>

          <div className="rounded-2xl border border-teal-500/30 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Interactive Slider Bar */}
            <div className="space-y-3 mb-8 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <Frown className="w-4 h-4" />
                  <span>0% Chaos Feed</span>
                </span>
                <span className="text-xs font-mono text-teal-300 font-bold">
                  {sanctuaryLevel}% Aletheia Calm Sanctuary
                </span>
                <span className="flex items-center gap-1.5 text-teal-300">
                  <Smile className="w-4 h-4" />
                  <span>100% Peace</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sanctuaryLevel}
                onChange={(e) => setSanctuaryLevel(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />
            </div>

            {/* Dynamic Card Transformation */}
            {isHighSanctuary ? (
              <div className="rounded-2xl border border-teal-500/30 bg-slate-950/70 p-6 text-left space-y-4 transition-all duration-500 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-xs font-semibold text-teal-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    Global Climate & Energy Briefing • Neutral Synthesis
                  </span>
                  <span className="text-[11px] bg-teal-950/80 text-teal-300 px-2.5 py-0.5 rounded-full border border-teal-500/30 font-medium">
                    Calm Reading Pace
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-white">
                  Renewable Grid Capacity Exceeds 30% Milestone in European Energy Reports
                </h3>

                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-teal-400 font-bold mt-0.5">●</span>
                    <span><strong className="text-white">What occurred:</strong> Combined wind and solar installations supplied 32.4% of power over the last quarter.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-teal-400 font-bold mt-0.5">●</span>
                    <span><strong className="text-white">Practical significance:</strong> Energy storage batteries and baseline transmission investments continue steady deployment.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-teal-400 font-bold mt-0.5">●</span>
                    <span><strong className="text-white">Next milestone:</strong> Scheduled review of winter reserve capacities set for late November.</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-teal-400/90 italic flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ground truth verified across 3 neutral meteorological & power wire services.</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-rose-600 bg-rose-950/30 p-6 text-left space-y-4 transition-all duration-500 animate-in shake">
                <div className="flex items-center justify-between pb-3 border-b border-rose-500/40">
                  <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    🚨 BREAKING EMERGENCY ALERT: CRISIS IMMINENT
                  </span>
                  <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-700 animate-pulse font-mono">
                    PULSE: 140 BPM
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-extrabold text-rose-200">
                  CATASTROPHIC BLACKOUT WARNING! ARE YOU AND YOUR FAMILY PREPARED FOR COMPLETE COLLAPSE?!
                </h3>

                <p className="text-xs text-rose-200/80 leading-relaxed italic">
                  "Terrifying new reports reveal power grids are teetering on the edge of destruction... Click to see the 5 shocking secrets the electric company doesn't want you to know!"
                </p>

                <div className="flex flex-wrap gap-2 text-[10px] text-rose-400">
                  <span className="px-2 py-1 bg-rose-950 rounded border border-rose-800">#Catastrophe</span>
                  <span className="px-2 py-1 bg-rose-950 rounded border border-rose-800">#PanicNow</span>
                  <span className="px-2 py-1 bg-rose-950 rounded border border-rose-800">#NoHope</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Cognitive Load Mode Selector */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-teal-400 font-bold">
              Personal Mental Bandwidth
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2">
              Adjustable Cognitive Load
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2">
              Match your news consumption to your current energy level.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <button
              onClick={() => setCognitiveLoad("low")}
              className={`p-5 rounded-2xl border transition text-left space-y-2 ${
                cognitiveLoad === "low"
                  ? "bg-teal-950/50 border-teal-400 shadow-lg shadow-teal-500/20"
                  : "bg-slate-900/50 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">1. Low Cognitive Load</span>
                <Coffee className="w-4 h-4 text-teal-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                For busy or tired evenings. Ultra-compact 1-sentence takeaways with zero complex jargon.
              </p>
            </button>

            <button
              onClick={() => setCognitiveLoad("balanced")}
              className={`p-5 rounded-2xl border transition text-left space-y-2 ${
                cognitiveLoad === "balanced"
                  ? "bg-teal-950/50 border-teal-400 shadow-lg shadow-teal-500/20"
                  : "bg-slate-900/50 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">2. Balanced Reflection</span>
                <Sun className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Standard daily digest. 3 key factual bullets with timeline context and direct citations.
              </p>
            </button>

            <button
              onClick={() => setCognitiveLoad("deep")}
              className={`p-5 rounded-2xl border transition text-left space-y-2 ${
                cognitiveLoad === "deep"
                  ? "bg-teal-950/50 border-teal-400 shadow-lg shadow-teal-500/20"
                  : "bg-slate-900/50 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">3. Deep Learning</span>
                <Moon className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Weekend deep-dives. Multi-source comparative analysis with background context.
              </p>
            </button>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-teal-400 font-bold">
              Peace of Mind Pricing
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              Invest in Your Mental Sanity
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-teal-950/40 border-2 border-teal-500/50 shadow-2xl shadow-teal-500/10 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-teal-400 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider">
              Wellness Special: $10 Off Month 1
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-teal-300 font-semibold uppercase">Subscriber Sanctuary</span>
                <div className="flex items-baseline gap-2 font-mono mt-1">
                  <span className="text-4xl font-extrabold text-white">$5</span>
                  <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                  <span className="text-xs text-slate-400">/ 1st month · then $15/mo</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackLandingCta("Subscribe Wellness", "pricing");
                  trackAuthAction("sign_in_initiated", "wellness_pricing");
                  signIn("google", { callbackUrl: "/" });
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-500 hover:from-teal-300 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition"
              >
                <span>Activate Calm News Access</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Finite daily feed with gentle completion boundaries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Zero algorithmic engagement hooks or rage bait</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Gentle AI companion ready to explain complex questions calmly</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                <span>Private & personal — no ad tracking or profiles sold</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-teal-400 font-bold">FAQ</span>
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
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white hover:text-teal-300 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-teal-400" : ""
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
