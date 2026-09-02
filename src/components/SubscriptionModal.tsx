"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Zap,
  Check,
  ShieldCheck,
  ArrowRight,
  Lock,
  CreditCard,
  X,
  ExternalLink,
  Flame,
  Clock,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { AppUser, UserTier, UsageLimitStatus } from "@/core/types/contracts";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: AppUser | null;
  limitStatus?: UsageLimitStatus | null;
  isAdmin?: boolean;
  onSuccess?: () => void;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  user,
  limitStatus,
  isAdmin = false,
  onSuccess,
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin Stripe Test Mode State
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("aletheia_stripe_test_mode") === "true";
  });
  const [testCardNumber, setTestCardNumber] = useState("4242 4242 4242 4242");
  const [testExpDate, setTestExpDate] = useState("12/28");
  const [testCvc, setTestCvc] = useState("123");
  const [testProcessing, setTestProcessing] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSubscriber = user?.tier === "subscriber";

  const toggleTestMode = () => {
    const next = !isTestMode;
    setIsTestMode(next);
    setError(null);
    setTestSuccessMessage(null);
    try {
      localStorage.setItem("aletheia_stripe_test_mode", String(next));
    } catch {}
  };

  const handleCheckout = async (forceTestMode?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          testMode: forceTestMode ?? isTestMode,
        }),
      });

      const data = await res.json();
      if (data.success && data.checkoutUrl) {
        if (data.isMock) {
          // If running in local mock mode, sync and notify
          await fetch("/api/stripe/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: data.sessionId, userId: user?.id }),
          });
          if (onSuccess) onSuccess();
          onClose();
          window.location.reload();
        } else {
          window.location.href = data.checkoutUrl;
        }
      } else {
        setError(data.error || "Failed to initialize checkout session");
      }
    } catch (err) {
      setError("Network connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestPayment = async () => {
    setTestProcessing(true);
    setError(null);
    setTestSuccessMessage(null);
    try {
      const res = await fetch("/api/stripe/test-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          cardNumber: testCardNumber,
          expDate: testExpDate,
          cvc: testCvc,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestSuccessMessage(
          data.message || "Test payment approved! Subscription activated with $3.00/mo compute cap."
        );
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || "Test card payment declined");
      }
    } catch (err) {
      setError("Network error communicating with test charge simulator");
    } finally {
      setTestProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (data.success && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        setError(data.error || "Could not open billing portal");
      }
    } catch (err) {
      setError("Network error opening billing portal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in-50 duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-950/50 overflow-hidden my-8">
        {/* Glow Accents */}
        <div className="absolute top-0 right-1/4 w-72 h-40 bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-72 h-40 bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 flex items-center justify-center font-bold text-slate-950 shadow-md shadow-cyan-500/20">
              α
            </div>
            <div>
              <h2 id="subscription-modal-title" className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                <span>PROJECT ALETHEIA MEMBERSHIP</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                  Stripe Powered
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Test Mode Toggle */}
            {isAdmin && (
              <button
                onClick={toggleTestMode}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 transition border ${
                  isTestMode
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20"
                    : "bg-slate-800 text-slate-400 border-white/10 hover:text-slate-200"
                }`}
                title="Toggle Stripe Test Mode to simulate payments with test credit cards"
              >
                <FlaskConical className="w-3 h-3 text-amber-400" />
                <span>TEST MODE: {isTestMode ? "ON" : "OFF"}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
              aria-label="Close subscription modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Admin Test Mode Banner */}
          {isTestMode && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <FlaskConical className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>Admin Stripe Test Mode Active:</strong> You can subscribe using test credit cards without real charges.
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                SANDBOX
              </span>
            </div>
          )}

          {/* Hero Callout / First Month Promo */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/70 via-indigo-950/50 to-slate-900/80 border border-cyan-500/30 p-5 text-center sm:text-left sm:flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono font-medium border border-cyan-500/40">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>FIRST MONTH SPECIAL OFFER</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                $10 Off Your First Month
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enjoy full unconstrained news synthesis and epistemic companion analysis for only{" "}
                <strong className="text-cyan-300 font-bold">$5.00</strong> your first month, then $15/mo.
              </p>
            </div>
            <div className="mt-3 sm:mt-0 flex-shrink-0 text-center sm:text-right">
              <div className="text-3xl font-extrabold text-white font-mono flex items-baseline justify-center sm:justify-end gap-1">
                <span className="text-cyan-400">$5</span>
                <span className="text-xs font-normal text-slate-400 line-through mr-1">$15</span>
                <span className="text-xs font-normal text-slate-400">/ 1st mo</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">renews at $15/month</span>
            </div>
          </div>

          {/* Current Quota Notice if Triggered by Limit */}
          {limitStatus && !limitStatus.allowed && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-3">
              <Flame className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <strong>Free Monthly Limit Reached:</strong> You have consumed ${limitStatus.currentCost.toFixed(2)} of your $0.50 free epistemic compute quota. Upgrade to unlock $3.00/mo allowance (6x capacity) and uninterrupted deep analysis.
              </div>
            </div>
          )}

          {/* Success Message After Test Charge */}
          {testSuccessMessage && (
            <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-mono space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Test Subscription Activated!</span>
              </div>
              <p className="text-emerald-100">{testSuccessMessage}</p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={() => {
                    setTestSuccessMessage(null);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition"
                >
                  Continue Reading
                </button>
              </div>
            </div>
          )}

          {/* Interactive Test Card Terminal (Visible in Test Mode) */}
          {isTestMode ? (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-amber-500/50 space-y-4 shadow-xl shadow-amber-950/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono font-bold text-amber-300 uppercase">
                    Stripe Test Card Terminal
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Amount: $5.00
                </span>
              </div>

              {/* Preset Test Cards */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-slate-400">QUICK-FILL TEST CARDS:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setTestCardNumber("4242 4242 4242 4242");
                      setTestExpDate("12/28");
                      setTestCvc("123");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 transition"
                  >
                    <Check className="w-3 h-3 text-cyan-400" />
                    <span>4242 (Success)</span>
                  </button>

                  <button
                    onClick={() => {
                      setTestCardNumber("4000 0000 0000 0002");
                      setTestExpDate("12/28");
                      setTestCvc("123");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 flex items-center gap-1 transition"
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>0002 (Decline)</span>
                  </button>

                  <button
                    onClick={() => {
                      setTestCardNumber("4000 0000 0000 0115");
                      setTestExpDate("01/20");
                      setTestCvc("123");
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1 transition"
                  >
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>0115 (Expired)</span>
                  </button>
                </div>
              </div>

              {/* Card Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-1">
                    TEST CARD NUMBER
                  </label>
                  <input
                    type="text"
                    value={testCardNumber}
                    onChange={(e) => setTestCardNumber(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm focus:outline-none focus:border-amber-400 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      EXPIRATION (MM/YY)
                    </label>
                    <input
                      type="text"
                      value={testExpDate}
                      onChange={(e) => setTestExpDate(e.target.value)}
                      placeholder="12/28"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm focus:outline-none focus:border-amber-400 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-1">
                      CVC CODE
                    </label>
                    <input
                      type="text"
                      value={testCvc}
                      onChange={(e) => setTestCvc(e.target.value)}
                      placeholder="123"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-mono text-sm focus:outline-none focus:border-amber-400 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleTestPayment}
                  disabled={testProcessing}
                  className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
                >
                  {testProcessing ? (
                    <span>Processing Test Charge...</span>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Submit Test Payment ($5.00)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={loading}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-white/10 flex items-center justify-center gap-2 transition"
                  title="Open Stripe's hosted checkout page in test mode"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Stripe Hosted Test Page</span>
                </button>
              </div>
            </div>
          ) : (
            /* Side-by-Side Tier Comparison (Standard Flow) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Basic / Free Tier */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      Basic Tier
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-mono">
                      Free
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">$0</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Everyday sanitized news reading with fundamental companion intelligence.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>~$0.50/mo epistemic compute allowance</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>100% bias-stripped multi-source feeds</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>Mind-State personal interest tracking</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>Direct source verification & citations</span>
                    </li>
                  </ul>
                </div>
                <div className="pt-2">
                  <div className="w-full py-2 text-center text-xs font-mono text-slate-500 bg-slate-800/40 rounded-xl border border-white/5">
                    {isSubscriber ? "Previous Tier" : "Current Plan"}
                  </div>
                </div>
              </div>

              {/* Subscriber Tier */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950/40 border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/10 space-y-4 flex flex-col justify-between relative">
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] font-mono tracking-wide shadow-md shadow-cyan-500/30">
                  RECOMMENDED
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Subscriber Tier</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono font-medium">
                      $10 Off 1st Mo
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-2xl font-bold text-white">$15</span>
                    <span className="text-xs text-slate-400">/ month</span>
                    <span className="text-xs text-cyan-300 font-semibold ml-1">($5 first month)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    High-capacity epistemic companion for serious analysts, researchers, and daily readers.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-200 pt-2 border-t border-cyan-500/20">
                    <li className="flex items-center gap-2 font-medium text-cyan-200">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>~$3.00/mo compute allowance (6x capacity)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>Priority live wire research & search retrieval</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>Unrestricted companion dialogue deep-dives</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>Multi-tier thematic intersections & discovery</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2">
                  {isSubscriber ? (
                    <button
                      onClick={handleManageBilling}
                      disabled={loading}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono font-semibold border border-cyan-500/40 flex items-center justify-center gap-2 transition"
                    >
                      <span>Manage Billing with Stripe</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(false)}
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 hover:from-cyan-400 hover:via-teal-300 hover:to-indigo-500 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition transform active:scale-95 disabled:opacity-50"
                    >
                      {loading ? (
                        <span>Redirecting to Stripe...</span>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Subscribe Now — $5 First Month</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs text-center font-mono">
              {error}
            </div>
          )}

          {/* Trust Footnote */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>PCI-Compliant 256-bit encryption handled directly by Stripe</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Cancel or pause anytime with one click in the billing portal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
