"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  LifeBuoy,
  Send,
  AlertCircle,
  CheckCircle2,
  Bug,
  Sparkles,
  Lightbulb,
  CreditCard,
  MessageSquare,
  Copy,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  Clock,
  HelpCircle,
} from "lucide-react";
import { SupportCategory, SupportTicketPayload } from "@/core/types/contracts";

const CATEGORIES: {
  id: SupportCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: "bug_report",
    label: "Bug Report",
    icon: Bug,
    description: "Something is broken or behaving unexpectedly",
  },
  {
    id: "ai_feed_synthesis",
    label: "AI & Synthesis",
    icon: Sparkles,
    description: "Feed ranking, summaries, or curiosity topics",
  },
  {
    id: "feature_request",
    label: "Feature Request",
    icon: Lightbulb,
    description: "Ideas or capabilities you'd love to see",
  },
  {
    id: "account_billing",
    label: "Billing & Account",
    icon: CreditCard,
    description: "Subscriptions, Stripe, or login questions",
  },
  {
    id: "general_inquiry",
    label: "General Inquiry",
    icon: MessageSquare,
    description: "Any other questions or feedback",
  },
];

export default function SupportPage() {
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<SupportCategory>("bug_report");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    ticketId: string;
    message: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (session?.user) {
      if (!name) setName(session.user.name || "");
      if (!email) setEmail(session.user.email || "");
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address so we can reply to you.");
      return;
    }

    if (!trimmedSubject || trimmedSubject.length < 3) {
      setErrorMessage("Please enter a brief subject line (at least 3 characters).");
      return;
    }

    if (!trimmedMessage || trimmedMessage.length < 10) {
      setErrorMessage("Please provide a detailed description of your issue (at least 10 characters).");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: SupportTicketPayload = {
        name: name.trim() || trimmedEmail.split("@")[0],
        email: trimmedEmail,
        category,
        subject: trimmedSubject,
        message: trimmedMessage,
        metadata: {
          includeDiagnostics,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          screenWidth: typeof window !== "undefined" ? window.innerWidth : undefined,
          screenHeight: typeof window !== "undefined" ? window.innerHeight : undefined,
        },
      };

      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit support ticket");
      }

      setSuccessResult({
        ticketId: data.ticketId,
        message: data.message || "Your support request has been received.",
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyTicketId = () => {
    if (!successResult?.ticketId) return;
    navigator.clipboard.writeText(successResult.ticketId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReset = () => {
    setSuccessResult(null);
    setSubject("");
    setMessage("");
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent blur-3xl opacity-70" />
      </div>

      {/* Navigation Bar */}
      <header className="relative z-10 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-slate-900 border border-transparent hover:border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Feed</span>
          </Link>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-xs">
              α
            </div>
            <span className="font-mono font-bold tracking-wider text-sm text-white">ALETHEIA</span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 hidden md:inline">
              / Support
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Normal</span>
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-14">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support & Diagnostics</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-sans">
            How can we help?
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Report an issue, share feedback on AI synthesis, or get in touch directly. Our engineering team reviews every submission and replies directly to your inbox.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Container */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-slate-900/60 border border-white/15 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
              {successResult ? (
                /* Success View */
                <div className="py-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Ticket Submitted Successfully</h2>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      Thank you! Your ticket has been logged and dispatched directly to engineering via SES. We will reply to <span className="text-cyan-300 font-mono">{email}</span>.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono">
                    <span className="text-slate-400">TICKET REF:</span>
                    <span className="text-slate-200 font-bold truncate max-w-[220px]">{successResult.ticketId}</span>
                    <button
                      onClick={handleCopyTicketId}
                      className="p-1 hover:text-cyan-400 transition"
                      title="Copy Ticket ID"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                      href="/"
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-bold transition shadow-lg shadow-cyan-500/20 text-center"
                    >
                      Return to Feed
                    </Link>
                    <button
                      onClick={handleReset}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/15 text-slate-300 hover:text-white text-xs font-mono transition"
                    >
                      Submit Another Request
                    </button>
                  </div>
                </div>
              ) : (
                /* Main Support Form */
                <form onSubmit={handleSubmit} className="space-y-5">
                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{errorMessage}</span>
                    </div>
                  )}

                  {/* Category Selection */}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-2 font-semibold">
                      Issue Category
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = category === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                              isSelected
                                ? "bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm shadow-cyan-500/20"
                                : "bg-slate-950/60 hover:bg-slate-950 border-white/10 text-slate-300 hover:text-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Icon
                                className={`w-4 h-4 ${
                                  isSelected ? "text-cyan-400" : "text-slate-400"
                                }`}
                              />
                              <span className="text-xs font-medium">{cat.label}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 leading-tight">
                              {cat.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Name and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Turing"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
                      />
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                      Subject <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Brief headline of the issue or question..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Detailed Description <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[10px] font-mono text-slate-500">
                        {message.length} characters
                      </span>
                    </div>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe what occurred, any relevant error messages, or steps to reproduce..."
                      className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans resize-none leading-relaxed"
                    />
                  </div>

                  {/* Diagnostics Checkbox */}
                  <div className="flex items-start gap-2.5 pt-1">
                    <input
                      id="includeDiagnosticsFull"
                      type="checkbox"
                      checked={includeDiagnostics}
                      onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                      className="mt-0.5 rounded border-white/20 bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950 cursor-pointer"
                    />
                    <label
                      htmlFor="includeDiagnosticsFull"
                      className="text-xs text-slate-400 leading-snug cursor-pointer select-none"
                    >
                      Attach diagnostic environment metadata (browser version, OS, screen dimensions) to help resolve this faster.
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/10 flex items-center justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sending Support Request...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Ticket</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Support Guidelines & FAQ */}
          <div className="lg:col-span-5 space-y-6">
            {/* Quick Information Cards */}
            <div className="rounded-2xl bg-slate-900/40 border border-white/10 p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Support Guidelines</span>
              </h3>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 border border-white/10 text-cyan-400 flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Response Time</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      We actively monitor tickets and generally reply within 24 hours during business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 border border-white/10 text-cyan-400 flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Direct Email Delivery</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Your message is delivered directly to engineering via Amazon SES. When we reply, you&apos;ll receive an email directly from our team.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-950 border border-white/10 text-cyan-400 flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Privacy & Security</h4>
                    <p className="text-slate-400 mt-0.5 leading-relaxed">
                      Diagnostics contain only device display and browser specifications. We never collect personal credentials or passwords.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-2xl bg-slate-900/30 border border-white/5 p-5 text-xs font-mono space-y-2 text-slate-400">
              <div className="text-slate-300 font-semibold mb-1">Common Actions:</div>
              <div>
                • Manage subscriptions: Click your avatar in the top right &gt; <span className="text-cyan-400">Manage Subscription</span>
              </div>
              <div>
                • Discover topics: Click any pill in the top interest navigation
              </div>
              <div>
                • Read clean journalism: Zero ads, zero clickbait
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-950 px-4 sm:px-8 py-8 text-center text-xs text-slate-500">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-4 h-4 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-bold text-[10px]">
            α
          </div>
          <span className="font-mono font-bold text-slate-300">ALETHEIA</span>
          <span>• Part of the ciclops.io ecosystem</span>
        </div>
        <p>© {new Date().getFullYear()} Aletheia. All rights reserved.</p>
      </footer>
    </div>
  );
}
