"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  BookOpen,
  GraduationCap,
  Library,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Eye,
  Search,
  Sparkles,
  ChevronDown,
  Check,
  History,
  FileCheck,
  Scale,
  Compass,
} from "lucide-react";
import PersonaNav from "./PersonaNav";
import PersonaFooter from "./PersonaFooter";
import { trackLandingCta, trackAuthAction } from "@/lib/analytics";

export default function ScholarLandingClient() {
  const [selectedWire, setSelectedWire] = useState<string>("reuters");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const wireSources = [
    {
      id: "reuters",
      name: "Reuters Wire",
      region: "Global",
      reported: "Discloses treaty ratification vote results with specific clause numbers.",
      timestamp: "14:02 UTC",
      biasRating: "Centrist / Direct Wire",
    },
    {
      id: "ap",
      name: "Associated Press",
      region: "North America",
      reported: "Confirms voting tallies and quotes official statements from ministry chairs.",
      timestamp: "14:05 UTC",
      biasRating: "Direct Wire / High Factual",
    },
    {
      id: "afp",
      name: "Agence France-Presse",
      region: "Europe",
      reported: "Highlights diplomatic concessions on maritime boundaries and timeline clauses.",
      timestamp: "14:11 UTC",
      biasRating: "Direct Wire / High Factual",
    },
    {
      id: "bloomberg",
      name: "Bloomberg Terminal",
      region: "Financial Markets",
      reported: "Notes currency stabilizing in response to bilateral treaty signing.",
      timestamp: "14:16 UTC",
      biasRating: "Financial / Quantitative",
    },
  ];

  const activeWireObj = wireSources.find((w) => w.id === selectedWire) || wireSources[0];

  const faqs = [
    {
      q: "How does Aletheia preserve historical continuity?",
      a: "Traditional news operates on an amnesiac 24-hour cycle where prior context is discarded for whatever is trending right now. Aletheia maintains a persistent User Knowledge Graph and Topic Evolution Node that tracks story arcs over months, showing how today's event connects to historical antecedents.",
    },
    {
      q: "What methodology is used for citation provenance?",
      a: "Every synthesized fact card requires multiple corroborating wire sources. Claims found in only a single partisan outlet are isolated and explicitly flagged as disputed claims, preventing uncorroborated assertions from passing as established fact.",
    },
    {
      q: "Can I use Aletheia for academic research and literature reviews?",
      a: "Yes. Many educators, researchers, and graduate students use Aletheia to cut through the sensational noise of contemporary geopolitics, science policy, and economics to isolate verified timeline data and direct wire citations.",
    },
    {
      q: "Does Aletheia offer discounts for academic institutions?",
      a: "Our generous Basic tier is 100% free forever for students, educators, and scholars. For deep inquiry and high-capacity companion access, our Subscriber tier is just $5 for your first month.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090814] text-slate-100 selection:bg-violet-500 selection:text-white flex flex-col font-sans overflow-x-hidden">
      {/* Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-violet-600/20 via-purple-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[500px] bg-indigo-600/15 blur-3xl opacity-50" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-sky-600/15 blur-3xl opacity-50" />
      </div>

      <PersonaNav currentPersona="scholar" accentColor="violet" />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-mono mb-6 shadow-sm shadow-violet-500/10">
            <BookOpen className="w-3.5 h-3.5 text-violet-400" />
            <span>ALETHEIA // SCHOLARS, ACADEMICS & FACT PURISTS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
            Restore epistemic rigor.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-300 to-sky-300">
              Primary source provenance over outrage.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            For historians, educators, students, and thinkers who demand verifiable citations, Hegelian dialectic synthesis, and chronological memory instead of hysterical 24-hour churn.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started Scholar", "hero");
                trackAuthAction("sign_in_initiated", "scholar_hero");
                signIn("google", { callbackUrl: "/" });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-violet-500/25 transition transform active:scale-95"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Sign In with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              href="/?explore=true"
              onClick={() => {
                trackLandingCta("Explore Live Scholar", "hero");
                trackAuthAction("guest_explore_start", "scholar_hero");
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 hover:border-white/20 text-slate-200 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition"
            >
              <Eye className="w-4 h-4 text-violet-400" />
              <span>Explore Live Preview</span>
            </Link>
          </div>

          {/* Metric Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-violet-400" />
              <span>Multi-Wire Provenance Trees</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <span>Hegelian Dialectic Synthesis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-violet-400" />
              <span>Long-Term Topic Evolution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero Partisan Cherry-Picking</span>
            </div>
          </div>

          {/* Hero Visual Display with Generated Media */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-violet-500/30 bg-slate-900/50 shadow-2xl shadow-violet-500/10 group relative">
              <img
                src="/images/landing/personas/scholar-hero.jpg"
                alt="Grand academic library of the future with epistemic knowledge prism and holographic citation lattice"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-violet-300 font-semibold bg-violet-950/90 px-2.5 py-1 rounded-md border border-violet-500/40">
                    Epistemic Architecture
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-white mt-1.5 font-serif">
                    The Dialectic Knowledge Prism
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5 font-sans">
                    Transforming fragmented, reactionary reporting into verified archival truth with permanent source provenance.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-violet-950/80 text-violet-300 border border-violet-500/30 flex items-center gap-1.5 font-mono">
                    <Scale className="w-3.5 h-3.5 text-violet-400" />
                    <span>Epistemic Integrity: 100%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Media Section: Multi-Wire Provenance Explorer */}
        <section id="interactive-media" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">
              Interactive Media Demonstration
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-serif">
              Multi-Wire Provenance & Dialectic Synthesis
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2 font-sans">
              Click through the wire source nodes below to inspect how Aletheia traces claims to their original reporting roots before generating a synthesized truth object.
            </p>
          </div>

          <div className="rounded-2xl border border-violet-500/30 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Interactive Wire Nodes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              {wireSources.map((wire) => {
                const isSelected = wire.id === selectedWire;
                return (
                  <button
                    key={wire.id}
                    onClick={() => setSelectedWire(wire.id)}
                    className={`p-3 rounded-xl text-left border transition ${
                      isSelected
                        ? "bg-violet-950/60 border-violet-400 shadow-lg shadow-violet-500/20"
                        : "bg-slate-950/40 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="text-xs font-bold text-white flex items-center justify-between">
                      <span>{wire.name}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{wire.region} · {wire.timestamp}</div>
                  </button>
                );
              })}
            </div>

            {/* Selected Wire Node Inspector */}
            <div className="rounded-xl bg-slate-950/90 border border-violet-500/20 p-5 text-left space-y-3 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-violet-300 uppercase tracking-wider font-semibold">
                  Source Provenance Node: {activeWireObj.name}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-500/30 font-mono">
                  {activeWireObj.biasRating}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                "{activeWireObj.reported}"
              </p>
            </div>

            {/* Dialectic Synthesis: Thesis, Antithesis, Verified Truth */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-sans">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold block">
                  Thesis (Official Position)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Signatory nations state the maritime treaty solidifies peace, guarantees shared fishing rights, and establishes an arbitration committee.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold block">
                  Antithesis (Disputed Concerns)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Domestic opposition parties voice concern that mineral exploration rights favor northern consortia; parliamentary debate scheduled.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2">
                <span className="text-[10px] font-mono text-violet-300 uppercase tracking-wider font-semibold block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" />
                  <span>Verified Synthesis (Aletheia Fact Object)</span>
                </span>
                <p className="text-xs text-violet-200 leading-relaxed font-medium">
                  Treaty is ratified with a 72-28 majority; mineral clauses are subject to a separate 2026 protocol. Immediate border enforcement begins October 1st.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Epistemic Values Section */}
        <section id="value-pillars" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">
              Scholarly Values
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-serif">
              Built on Classical Intellectual Rigor
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-violet-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Library className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-serif">Deep Archival Provenance</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Never accept an uncorroborated leak or sensational tweet as historical record. Every narrative is anchored to primary documents, transcripts, and official wires.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-sky-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-serif">Dialectic Neutrality</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aletheia refuses to take partisan sides or indulge in political cheerleading. Opposing perspectives are structured clearly side-by-side with verified common ground highlighted.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-serif">Epistemic Evolution</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your personal knowledge graph maintains historical continuity across time. Watch ongoing scientific trials, legal battles, and diplomatic talks progress without losing historical thread.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">
              Scholar Membership
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 font-serif">
              Unrestricted Dialectic Inquiry
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-violet-950/40 border-2 border-violet-500/50 shadow-2xl shadow-violet-500/10 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-violet-500 text-white text-[10px] font-mono font-bold uppercase tracking-wider">
              Academic Special: $10 Off Month 1
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-violet-300 font-semibold uppercase">Subscriber Tier</span>
                <div className="flex items-baseline gap-2 font-mono mt-1">
                  <span className="text-4xl font-extrabold text-white">$5</span>
                  <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                  <span className="text-xs text-slate-400">/ 1st month · then $15/mo</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackLandingCta("Subscribe Scholar", "pricing");
                  trackAuthAction("sign_in_initiated", "scholar_pricing");
                  signIn("google", { callbackUrl: "/" });
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 transition"
              >
                <span>Activate Scholarly Intelligence</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span>6x inquiry capacity for thesis & research queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span>Priority global wire & preprint retrieval</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span>Cross-temporal epistemic timeline tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span>Strict privacy — no research queries logged for ads</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-violet-400 font-bold">FAQ</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif">
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
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-serif font-semibold text-white hover:text-violet-300 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-violet-400" : ""
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
