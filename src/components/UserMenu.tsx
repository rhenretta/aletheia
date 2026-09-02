"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User,
  ChevronDown,
  Terminal,
  RotateCcw,
  Trash2,
  Users,
  LogOut,
  LogIn,
  ExternalLink,
  Compass,
  Shield,
  EyeOff,
  Sparkles,
  CreditCard,
} from "lucide-react";
import { ContextualSelection, AppUser, UserTier, UsageLimitStatus } from "@/core/types/contracts";

export interface UserMenuProps {
  session: any;
  isAdmin: boolean;
  viewingUser?: AppUser | null;
  onExitViewMode?: () => void;
  tier?: UserTier;
  limitStatus?: UsageLimitStatus | null;
  onOpenSubscriptionModal?: () => void;
  onOpenDevTools: () => void;
  isDevToolsOpen: boolean;
  selectedContext: ContextualSelection | null;
  onClearFeed: () => void;
  onResetProfile: () => void;
  isResettingProfile: boolean;
  onOpenUserManager: () => void;
  onSignOut: () => void | Promise<void>;
  onSignIn: () => void;
  isCollectingNews?: boolean;
}

export default function UserMenu({
  session,
  isAdmin,
  viewingUser,
  onExitViewMode,
  tier = "free",
  limitStatus,
  onOpenSubscriptionModal,
  onOpenDevTools,
  isDevToolsOpen,
  selectedContext,
  onClearFeed,
  onResetProfile,
  isResettingProfile,
  onOpenUserManager,
  onSignOut,
  onSignIn,
  isCollectingNews = false,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const userName = viewingUser
    ? viewingUser.name || viewingUser.email?.split("@")[0] || "User"
    : session?.user?.name || session?.user?.email?.split("@")[0] || "Guest";

  const userEmail = viewingUser
    ? viewingUser.email
    : session?.user?.email || (isAdmin ? "Development Mode" : "Signed out");

  const userImage = viewingUser ? viewingUser.image : session?.user?.image;
  const isViewingOtherUser = Boolean(viewingUser);

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl border text-xs font-mono transition shadow-sm select-none ${
          isOpen
            ? "bg-slate-800 border-cyan-500/50 text-white shadow-cyan-500/10"
            : isViewingOtherUser
            ? "bg-amber-950/40 hover:bg-amber-900/40 border-amber-500/40 text-amber-200 hover:text-white"
            : "bg-slate-900/90 hover:bg-slate-800/90 border-white/10 text-slate-200 hover:text-white hover:border-white/20"
        }`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={isViewingOtherUser ? `Viewing site perspective of ${userName}` : "User menu & controls"}
      >
        {userImage ? (
          <img
            src={userImage}
            alt={userName}
            className="w-5 h-5 rounded-full border border-white/20 object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-cyan-400">
            <User className="w-3 h-3" />
          </div>
        )}

        <span className="font-medium max-w-[110px] truncate text-left hidden sm:inline">
          {userName}
        </span>

        {isViewingOtherUser ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40 font-semibold tracking-wide">
            Viewing
          </span>
        ) : isAdmin ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-semibold tracking-wide">
            Admin
          </span>
        ) : null}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-cyan-300" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/60 p-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-150 divide-y divide-white/5 font-sans">
          {/* User Identity Header */}
          <div className="p-3">
            <div className="flex items-center gap-3">
              {userImage ? (
                <img
                  src={userImage}
                  alt={userName}
                  className="w-9 h-9 rounded-full border border-white/20 object-cover flex-shrink-0"
                />
              ) : (
                <div className={`w-9 h-9 rounded-full ${isViewingOtherUser ? "bg-amber-950/60 border-amber-500/30 text-amber-300" : "bg-slate-800/90 border-cyan-500/30 text-cyan-400"} border flex items-center justify-center flex-shrink-0 shadow-inner`}>
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white truncate">{userName}</p>
                  {isAdmin && (
                    <span title="Administrator" className="flex items-center">
                      <Shield className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{userEmail}</p>
              </div>
            </div>

            {isViewingOtherUser ? (
              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-amber-400">
                <span>PERSPECTIVE</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/30 uppercase">
                  {viewingUser?.role || "user"} (Read-Only)
                </span>
              </div>
            ) : isAdmin ? (
              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                <span>ROLE</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                  Administrator
                </span>
              </div>
            ) : null}
          </div>

          {/* Monthly Compute Quota & Subscription Widget */}
          {session?.user && (
            <div className="p-3 bg-slate-900/40 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">TIER</span>
                {tier === "subscriber" ? (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span>Subscriber ($15/mo)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 font-medium">
                    Basic (Free)
                  </span>
                )}
              </div>

              {/* Compute Usage Progress Meter */}
              {limitStatus && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Monthly Compute</span>
                    <span className="text-slate-200 font-bold">
                      ${(limitStatus.currentCost ?? 0).toFixed(2)} / ${(limitStatus.limit ?? 0.5).toFixed(2)}
                      <span className="text-slate-400 font-normal ml-1">
                        ({limitStatus.percentUsed}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        limitStatus.percentUsed >= 90
                          ? "bg-rose-500"
                          : limitStatus.percentUsed >= 70
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(4, limitStatus.percentUsed))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upgrade / Manage Subscription Trigger */}
              {onOpenSubscriptionModal && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSubscriptionModal();
                  }}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-mono font-semibold flex items-center justify-center gap-2 transition ${
                    tier === "subscriber"
                      ? "bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30"
                      : "bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 hover:from-cyan-400 hover:via-teal-300 hover:to-indigo-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>
                    {tier === "subscriber" ? "Manage Subscription" : "Upgrade — $5 First Month"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Exit View Mode Button if currently impersonating */}
          {isViewingOtherUser && onExitViewMode && (
            <div className="py-1.5">
              <button
                onClick={() => {
                  onExitViewMode();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2.5 text-amber-300 hover:text-amber-200 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/30 transition shadow-sm"
              >
                <EyeOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="font-semibold">Exit View Mode</span>
              </button>
            </div>
          )}

          {/* Admin Tools Section */}
          {isAdmin && (
            <div className="py-1.5">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span>Admin Controls</span>
              </div>

              {/* DevTools Drawer Toggle */}
              <button
                onClick={() => {
                  onOpenDevTools();
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono flex items-center justify-between transition ${
                  isDevToolsOpen
                    ? "bg-amber-500/15 text-amber-300 font-semibold"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>DevTools</span>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    isDevToolsOpen
                      ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                      : "bg-slate-900 text-slate-400 border border-white/10"
                  }`}
                >
                  {isDevToolsOpen
                    ? selectedContext
                      ? `[${selectedContext.type}]`
                      : "Open"
                    : "Closed"}
                </span>
              </button>

              {/* User Manager Modal */}
              <button
                onClick={() => {
                  onOpenUserManager();
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>User Manager</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-mono">
                  Manage
                </span>
              </button>

              {/* Clear Feed Stories */}
              <button
                onClick={() => {
                  onClearFeed();
                  setIsOpen(false);
                }}
                disabled={isCollectingNews}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:bg-slate-900 hover:text-slate-100 flex items-center gap-2.5 transition disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>Clear Feed</span>
              </button>

              {/* Reset Profile & Memory */}
              <button
                onClick={() => {
                  onResetProfile();
                  setIsOpen(false);
                }}
                disabled={isResettingProfile}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono text-rose-300/90 hover:bg-rose-950/30 hover:text-rose-200 flex items-center justify-between transition disabled:opacity-40"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw
                    className={`w-4 h-4 text-rose-400 ${
                      isResettingProfile ? "animate-spin" : ""
                    }`}
                  />
                  <span>Reset Profile & Memory</span>
                </div>
                {isResettingProfile && (
                  <span className="text-[9px] text-rose-400 font-mono">Resetting...</span>
                )}
              </button>
            </div>
          )}

          {/* Quick Links */}
          <div className="py-1.5">
            <a
              href="https://ciclops.io"
              target="_blank"
              rel="noreferrer"
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-2 rounded-xl text-xs font-mono text-slate-300 hover:bg-slate-900 hover:text-white flex items-center justify-between transition"
            >
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>ciclops.io</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
          </div>

          {/* Auth Action (Sign Out / Sign In) */}
          <div className="p-1.5">
            {session?.user ? (
              <button
                onClick={async () => {
                  setIsOpen(false);
                  await onSignOut();
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 border border-rose-500/20 hover:border-rose-500/40 flex items-center gap-2.5 transition"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onSignIn();
                }}
                className="w-full px-3 py-2 rounded-xl text-xs font-mono text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition font-medium"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
