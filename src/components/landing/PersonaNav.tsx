"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Sparkles,
  ArrowRight,
  Terminal,
  Briefcase,
  BookOpen,
  HeartPulse,
  Scale,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { trackAuthAction, trackLandingCta } from "@/lib/analytics";

export type PersonaType = "tech" | "business" | "scholar" | "wellness" | "policy";

interface PersonaNavProps {
  currentPersona: PersonaType;
  accentColor?: "cyan" | "gold" | "violet" | "teal" | "amber";
}

const PERSONAS: Array<{
  id: PersonaType;
  title: string;
  tagline: string;
  href: string;
  icon: any;
  colorClass: string;
}> = [
  {
    id: "tech",
    title: "Engineers & AI",
    tagline: "Zero PR Hype, Pure Signal",
    href: "/tech",
    icon: Terminal,
    colorClass: "text-cyan-400 bg-cyan-950/60 border-cyan-500/40",
  },
  {
    id: "business",
    title: "Executives & VCs",
    tagline: "Strategic Alpha in 90s",
    href: "/business",
    icon: Briefcase,
    colorClass: "text-amber-400 bg-amber-950/60 border-amber-500/40",
  },
  {
    id: "scholar",
    title: "Scholars & Purists",
    tagline: "Primary Provenance & Rigor",
    href: "/scholar",
    icon: BookOpen,
    colorClass: "text-violet-400 bg-violet-950/60 border-violet-500/40",
  },
  {
    id: "wellness",
    title: "Mindful Readers",
    tagline: "Calm News Sanctuary",
    href: "/wellness",
    icon: HeartPulse,
    colorClass: "text-teal-400 bg-teal-950/60 border-teal-500/40",
  },
  {
    id: "policy",
    title: "Watchdogs & Press",
    tagline: "Cross-Bias Audit & Timeline",
    href: "/policy",
    icon: Scale,
    colorClass: "text-orange-400 bg-orange-950/60 border-orange-500/40",
  },
];

export default function PersonaNav({ currentPersona, accentColor = "cyan" }: PersonaNavProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);

  const activePersonaObj = PERSONAS.find((p) => p.id === currentPersona) || PERSONAS[0];

  return (
    <header className="relative z-30 border-b border-white/10 backdrop-blur-xl bg-slate-950/80 sticky top-0 px-4 sm:px-8 py-3 flex items-center justify-between">
      {/* Brand & Active Persona Badge */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 via-teal-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 text-lg shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition">
            α
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                ALETHEIA
              </span>
            </div>
          </div>
        </Link>

        {/* Persona Selector Dropdown (Desktop) */}
        <div className="relative hidden lg:block">
          <button
            onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-200 transition"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-slate-400">Edition:</span>
            <span className="font-semibold text-white">{activePersonaObj.title}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isPersonaMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isPersonaMenuOpen && (
            <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-white/15 p-2 shadow-2xl backdrop-blur-2xl z-50 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold border-b border-white/5">
                Switch Audience Lens
              </div>
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                const isSelected = p.id === currentPersona;
                return (
                  <Link
                    key={p.id}
                    href={p.href}
                    onClick={() => setIsPersonaMenuOpen(false)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition ${
                      isSelected
                        ? "bg-white/10 text-white font-medium"
                        : "hover:bg-white/5 text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border ${p.colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold">{p.title}</div>
                      <div className="text-[11px] text-slate-400">{p.tagline}</div>
                    </div>
                  </Link>
                );
              })}
              <div className="pt-1 border-t border-white/5">
                <Link
                  href="/"
                  onClick={() => setIsPersonaMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <span>General Edition</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nav Links (Desktop) */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
        <a href="#interactive-media" className="hover:text-cyan-300 transition">
          Interactive Media
        </a>
        <a href="#value-pillars" className="hover:text-cyan-300 transition">
          Values
        </a>
        <a href="#why-this-matters" className="hover:text-cyan-300 transition">
          Architecture
        </a>
        <a href="#pricing" className="hover:text-cyan-300 transition">
          Pricing
        </a>
        <a href="#faq" className="hover:text-cyan-300 transition">
          FAQ
        </a>
      </nav>

      {/* CTAs */}
      <div className="flex items-center gap-2.5">
        <Link
          href="/?explore=true"
          onClick={() => trackAuthAction("guest_explore_start", `persona_${currentPersona}`)}
          className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition"
        >
          Explore Live Preview
        </Link>
        <button
          onClick={() => {
            trackAuthAction("sign_in_initiated", `persona_${currentPersona}`);
            signIn("google", { callbackUrl: "/" });
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

        {/* Mobile menu toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 md:hidden"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-slate-950/95 border-b border-white/10 p-4 space-y-4 backdrop-blur-2xl md:hidden z-50">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
            All Audience Editions
          </div>
          <div className="grid grid-cols-1 gap-2">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const isSelected = p.id === currentPersona;
              return (
                <Link
                  key={p.id}
                  href={p.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 p-2 rounded-xl text-xs ${
                    isSelected
                      ? "bg-white/10 text-white font-semibold"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{p.title}</span>
                </Link>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
            <Link
              href="/?explore=true"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full py-2 text-center rounded-xl bg-slate-900 border border-white/10 text-xs font-medium text-slate-200"
            >
              Explore Live Preview
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
