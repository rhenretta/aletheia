"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Bug,
  Lightbulb,
  Sparkles,
  CreditCard,
  MessageSquare,
  Copy,
  Check,
  LifeBuoy,
  Loader2,
  Info,
} from "lucide-react";
import { SupportCategory, SupportTicketPayload } from "@/core/types/contracts";

export interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: any;
  tier?: string;
  initialCategory?: SupportCategory;
}

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

export default function SupportModal({
  isOpen,
  onClose,
  session,
  tier = "free",
  initialCategory = "bug_report",
}: SupportModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<SupportCategory>(initialCategory);
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

  const dialogRef = useRef<HTMLDivElement>(null);

  // Pre-fill user details if logged in
  useEffect(() => {
    if (session?.user) {
      if (!name) setName(session.user.name || "");
      if (!email) setEmail(session.user.email || "");
    }
  }, [session, isOpen]);

  // Handle Escape key and body lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
          tier,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-dialog-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-xl rounded-2xl bg-slate-950/95 border border-white/15 shadow-2xl shadow-cyan-950/40 p-5 sm:p-7 text-slate-200 overflow-hidden my-auto"
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-inner">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h2 id="support-dialog-title" className="text-lg font-bold text-white font-sans flex items-center gap-2">
                Help & Support
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Get in touch directly with issues, questions, or ideas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation View */}
        {successResult ? (
          <div className="py-8 text-center space-y-5 relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white">Ticket Submitted Successfully</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Thank you! Your issue has been logged and an alert has been delivered to engineering. We will reply directly to <span className="text-cyan-300 font-mono">{email}</span>.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono">
              <span className="text-slate-400">TICKET REF:</span>
              <span className="text-slate-200 font-bold truncate max-w-[200px]">{successResult.ticketId}</span>
              <button
                onClick={handleCopyTicketId}
                className="p-1 hover:text-cyan-400 transition"
                title="Copy Ticket ID"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </div>

            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-bold transition shadow-lg shadow-cyan-500/20"
              >
                Back to Aletheia
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-300 hover:text-white text-xs font-mono transition"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          /* Main Support Form */
          <form onSubmit={handleSubmit} className="pt-4 space-y-4 relative z-10">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Category Selector */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
                What type of issue is this?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? "bg-cyan-950/60 border-cyan-500/60 text-white shadow-sm shadow-cyan-500/20"
                          : "bg-slate-900/60 hover:bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            isSelected ? "text-cyan-400" : "text-slate-400"
                          }`}
                        />
                        <span className="text-xs font-medium">{cat.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-1">
                        {cat.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Identity Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Turing"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
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
                placeholder="Brief summary of the issue or question..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans"
              />
            </div>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Description & Details <span className="text-rose-400">*</span>
                </label>
                <span className="text-[10px] font-mono text-slate-500">
                  {message.length} chars
                </span>
              </div>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what happened, steps to reproduce, or what you'd like us to improve..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/60 font-sans resize-none leading-relaxed"
              />
            </div>

            {/* Diagnostics Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="includeDiagnostics"
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-950 cursor-pointer"
              />
              <label
                htmlFor="includeDiagnostics"
                className="text-[11px] text-slate-400 leading-snug cursor-pointer select-none"
              >
                Include technical diagnostic metadata (browser type, screen resolution, page URL) to speed up investigation.
              </label>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Info className="w-3 h-3 text-cyan-400" />
                <span>Sends directly to engineering</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
