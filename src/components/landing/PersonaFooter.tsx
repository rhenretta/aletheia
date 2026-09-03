"use client";

import React from "react";
import Link from "next/link";
import { Terminal, Briefcase, BookOpen, HeartPulse, Scale, ArrowRight } from "lucide-react";

export default function PersonaFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-slate-950 px-4 sm:px-8 py-12 text-xs text-slate-400 space-y-8">
      {/* 5 Editions Directory */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6 border-b border-white/5 pb-10">
        <div>
          <Link href="/tech" className="flex items-center gap-1.5 text-slate-200 font-semibold mb-2 hover:text-cyan-400 transition">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>For Engineers & AI</span>
          </Link>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Raw signal, zero PR spin, algorithm telemetry, and source code citations.
          </p>
        </div>

        <div>
          <Link href="/business" className="flex items-center gap-1.5 text-slate-200 font-semibold mb-2 hover:text-amber-400 transition">
            <Briefcase className="w-3.5 h-3.5 text-amber-400" />
            <span>For Executives & VCs</span>
          </Link>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            90-second executive briefs, market impact matrices, and strategic alpha.
          </p>
        </div>

        <div>
          <Link href="/scholar" className="flex items-center gap-1.5 text-slate-200 font-semibold mb-2 hover:text-violet-400 transition">
            <BookOpen className="w-3.5 h-3.5 text-violet-400" />
            <span>For Scholars & Purists</span>
          </Link>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Multi-wire provenance trees, dialectic synthesis, and epistemic rigor.
          </p>
        </div>

        <div>
          <Link href="/wellness" className="flex items-center gap-1.5 text-slate-200 font-semibold mb-2 hover:text-teal-400 transition">
            <HeartPulse className="w-3.5 h-3.5 text-teal-400" />
            <span>For Mindful Readers</span>
          </Link>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Calm news sanctuary, doomscroll detox, and nervous system regulation.
          </p>
        </div>

        <div>
          <Link href="/policy" className="flex items-center gap-1.5 text-slate-200 font-semibold mb-2 hover:text-orange-400 transition">
            <Scale className="w-3.5 h-3.5 text-orange-400" />
            <span>For Watchdogs & Press</span>
          </Link>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Cross-spectrum bias audit radar, statement contradiction tracker.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-[11px]">
            α
          </div>
          <span className="font-mono font-bold text-white">ALETHEIA</span>
          <span className="text-slate-500">• News Without Noise</span>
        </div>

        <div className="flex items-center gap-6 text-[11px] text-slate-400">
          <Link href="/" className="hover:text-white transition">
            Main Edition
          </Link>
          <Link href="/#pricing" className="hover:text-white transition">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-white transition">
            FAQ
          </Link>
          <Link href="/?explore=true" className="hover:text-white transition">
            Live Preview
          </Link>
        </div>

        <div className="text-[11px] text-slate-500">
          © {new Date().getFullYear()} Aletheia. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
