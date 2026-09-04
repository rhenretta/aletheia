"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Scale,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  ArrowRight,
  Eye,
  Sliders,
  History,
  ChevronDown,
  Check,
  Radar,
  Lock,
  GitCompare,
  Globe2,
} from "lucide-react";
import PersonaNav from "./PersonaNav";
import PersonaFooter from "./PersonaFooter";
import { trackLandingCta, trackAuthAction } from "@/lib/analytics";

export default function PolicyLandingClient() {
  const [selectedDisputeId, setSelectedDisputeId] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const sampleInvestigations = [
    {
      title: "Cross-Border Energy Pipeline Subsidies",
      wiresAudited: 6,
      consensusStatus: "Conflict Detected in Quoted Budget Numbers",
      wireADetails: "Wire A (State-Affiliated): Cites $1.2B allocation for green infrastructure.",
      wireBDetails: "Wire B (Independent Wire): Discloses unredacted appendix adding $4.8B in state guarantees.",
      aletheiaVerdict: "Verified Fact: Formal legislative bill authorizes $1.2B immediate grant with $4.8B contingency loan guarantee.",
    },
    {
      title: "Antitrust Compliance Timeline",
      wiresAudited: 5,
      consensusStatus: "Timeline Discrepancy",
      wireADetails: "Wire A: Reports compliance deadline is immediate upon signing.",
      wireBDetails: "Wire B: Notes 180-day grace period hidden in section 14(b).",
      aletheiaVerdict: "Verified Fact: Formal regulatory registry confirms 180-day compliance window before statutory penalties engage.",
    },
  ];

  const activeInvestigation = sampleInvestigations[selectedDisputeId];

  const faqs = [
    {
      q: "How does Aletheia detect narrative discrepancies?",
      a: "Our multi-agent epistemic pipeline compares multiple wire accounts of the exact same event in real-time. Where facts, figures, and direct quotes align across distinct jurisdictions, they are verified. Where claims diverge or rely on anonymous single-source hearsay, they are isolated into the Disputed Claims dossier.",
    },
    {
      q: "Does Aletheia take political stances?",
      a: "No. In strict accordance with our epistemic principles, Aletheia does not adopt partisan commentary or editorial cheerleading. The system maps conflicting assertions neutrally, providing direct links to transcripts and primary filings.",
    },
    {
      q: "Can I use Aletheia for investigative reporting or policy research?",
      a: "Yes. Journalists, policy fellows, and legal researchers use Aletheia to trace statement evolutions, corroborate timeline claims against international wires, and audit press releases for omitted context.",
    },
    {
      q: "How does the timeline scrubber work?",
      a: "Stories evolve dynamically over time. Aletheia constructs a temporal event graph showing who said what on Monday, how officials shifted language on Wednesday, and what formal filings confirmed by Friday.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d0909] text-slate-100 selection:bg-orange-500 selection:text-black flex flex-col font-sans overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-orange-600/20 via-red-600/10 to-transparent blur-3xl opacity-75" />
        <div className="absolute top-[35%] -left-32 w-[500px] h-[500px] bg-amber-600/10 blur-3xl opacity-50" />
        <div className="absolute top-[70%] -right-32 w-[500px] h-[500px] bg-red-600/15 blur-3xl opacity-50" />
      </div>

      <PersonaNav currentPersona="policy" accentColor="amber" />

      <main className="relative z-10 flex-1">
        {/* Hero Section */}
        <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs font-mono mb-6 shadow-sm shadow-orange-500/10">
            <Scale className="w-3.5 h-3.5 text-orange-400" />
            <span>ALETHEIA // INVESTIGATIVE WATCHDOGS & POLICY ANALYSTS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12]">
            Follow the story, not the spin.{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-rose-400">
              Independent multi-wire verification for civic minds.
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Equipping investigative reporters, legal observers, and civic watchdogs with cross-spectrum wire audits, discrepancy detection, and uncorrupted chronological timelines.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <button
              onClick={() => {
                trackLandingCta("Get Started Policy", "hero");
                trackAuthAction("sign_in_initiated", "policy_hero");
                signIn("google", { callbackUrl: "/" });
              }}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-orange-500/20 transition transform active:scale-95"
            >
              <FileSearch className="w-4 h-4 text-slate-950" />
              <span>Sign In with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <span>Cross-Wire Narrative Audits</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Disputed Claim Isolation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-rose-400" />
              <span>Chronological Flip-Flop Scrutiny</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Confidential Research Inquiries</span>
            </div>
          </div>

          {/* Hero Visual Display with Generated Media */}
          <div className="mt-12 sm:mt-16 relative mx-auto max-w-5xl">
            <div className="rounded-2xl overflow-hidden border border-orange-500/30 bg-slate-900/50 shadow-2xl shadow-orange-500/10 group relative">
              <img
                src="/images/landing/personas/policy-hero.jpg"
                alt="Investigative journalism intelligence center with global circular radar and statement discrepancy analysis"
                className="w-full h-auto object-cover transform group-hover:scale-[1.01] transition duration-700 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90" />
              <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 text-left">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-orange-300 font-semibold bg-orange-950/90 px-2.5 py-1 rounded-md border border-orange-500/40">
                    Civic Verification Engine
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-white mt-1.5 font-mono">
                    Global Wire Spectrum Scrutiny
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xl mt-0.5 font-sans">
                    Auditing statements in real time to uncover omitted riders, timeline contradictions, and institutional conflicts of interest.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-md bg-orange-950/80 text-orange-300 border border-orange-500/30 flex items-center gap-1.5 font-mono">
                    <Radar className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                    <span>Active Wire Monitoring</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Media Section: Discrepancy & Radar Audit Engine */}
        <section id="interactive-media" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-orange-400 font-bold">
              Interactive Media Demonstration
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-mono">
              Cross-Spectrum Discrepancy Engine
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-2 font-sans">
              Select an investigation below to see how Aletheia identifies diverging accounts between wire services and reconstructs the verified baseline.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-500/30 bg-slate-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-xl">
            {/* Investigation Selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {sampleInvestigations.map((inv, idx) => {
                const isSelected = selectedDisputeId === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDisputeId(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition ${
                      isSelected
                        ? "bg-orange-500 text-slate-950 shadow-lg shadow-orange-500/25"
                        : "bg-slate-950 border border-white/10 text-slate-300 hover:text-white"
                    }`}
                  >
                    Dossier #{idx + 1}: {inv.title}
                  </button>
                );
              })}
            </div>

            {/* Investigation Details Card */}
            <div className="rounded-xl bg-slate-950/90 border border-orange-500/30 p-5 text-left space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  <span className="text-xs font-bold text-orange-300">
                    AUDIT DOSSIER // {activeInvestigation.title.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  {activeInvestigation.wiresAudited} Global Wires Scanned
                </div>
              </div>

              {/* Wire A vs Wire B */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                    Official Press Release Account
                  </div>
                  <p className="text-slate-300 leading-relaxed italic">
                    {activeInvestigation.wireADetails}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
                  <div className="text-[10px] font-mono text-rose-400 uppercase font-bold">
                    Investigative Disclosure
                  </div>
                  <p className="text-slate-300 leading-relaxed italic">
                    {activeInvestigation.wireBDetails}
                  </p>
                </div>
              </div>

              {/* Grounded Truth Verdict */}
              <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-500/40 text-xs space-y-1 font-sans">
                <div className="text-[10px] font-mono uppercase tracking-wider text-orange-300 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aletheia Corroborated Ground Truth</span>
                </div>
                <p className="text-slate-200 leading-relaxed font-medium">
                  {activeInvestigation.aletheiaVerdict}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Watchdog Values */}
        <section id="value-pillars" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-white/5">
          <div className="text-center mb-12">
            <span className="text-xs font-mono uppercase tracking-widest text-orange-400 font-bold">
              Watchdog Values
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mt-2 font-mono">
              Uncompromising Fact Corroboration
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-orange-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Radar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Cross-Jurisdiction Wires</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                By synthesizing wires across North America, Europe, Asia, and independent non-profit registries, nationalistic blindspots are automatically eliminated.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-amber-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <GitCompare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Flip-Flop Tracker</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Aletheia remembers what leaders stated six months ago. When public policy statements shift without explanation, the timeline highlights the discrepancy.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-red-500/40 transition text-left space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white font-mono">Disputed Claim Isolation</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Unverified claims originating from single anonymous leaks are separated from factual consensus so hearsay is never masqueraded as established reality.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <span className="text-xs font-mono uppercase tracking-widest text-orange-400 font-bold">
              Watchdog Membership
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2 font-mono">
              Unrestricted Investigative Research
            </h2>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-orange-950/40 border-2 border-orange-500/50 shadow-2xl shadow-orange-500/10 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl bg-orange-500 text-slate-950 text-[10px] font-mono font-bold uppercase tracking-wider">
              Watchdog Special: $10 Off Month 1
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <span className="text-xs font-mono text-orange-300 font-semibold uppercase">Subscriber Tier</span>
                <div className="flex items-baseline gap-2 font-mono mt-1">
                  <span className="text-4xl font-extrabold text-white">$5</span>
                  <span className="text-sm text-slate-400 line-through mr-1">$15</span>
                  <span className="text-xs text-slate-400">/ 1st month · then $15/mo</span>
                </div>
              </div>
              <button
                onClick={() => {
                  trackLandingCta("Subscribe Policy", "pricing");
                  trackAuthAction("sign_in_initiated", "policy_pricing");
                  signIn("google", { callbackUrl: "/" });
                }}
                className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition font-mono"
              >
                <span>Activate Investigative Access</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>6x inquiry capacity for complex legal & policy queries</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>Priority multi-wire discrepancy detection</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>Chronological timeline reconstruction access</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <span>Encrypted private sessions — zero search logging</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto border-t border-white/5">
          <div className="text-center mb-8">
            <span className="text-xs font-mono uppercase tracking-widest text-orange-400 font-bold">FAQ</span>
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
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-mono font-semibold text-white hover:text-orange-300 transition"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? "rotate-180 text-orange-400" : ""
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
