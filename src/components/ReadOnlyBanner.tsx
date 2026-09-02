"use client";

import React from "react";
import { Eye, ShieldAlert, ArrowLeft, Users, Lock } from "lucide-react";
import { AppUser } from "@/core/types/contracts";

interface ReadOnlyBannerProps {
  viewingUser: AppUser;
  onExit: () => void;
  onSwitchUser?: () => void;
}

export default function ReadOnlyBanner({
  viewingUser,
  onExit,
  onSwitchUser,
}: ReadOnlyBannerProps) {
  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-amber-950/95 via-slate-950/95 to-amber-950/95 border-b border-amber-500/30 backdrop-blur-md px-4 py-2 text-xs shadow-xl shadow-amber-950/20 animate-in slide-in-from-top duration-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Eye className="w-3.5 h-3.5 animate-pulse" />
          </div>

          <div className="flex items-center gap-2 flex-wrap font-mono">
            <span className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-amber-400" />
              READ-ONLY MODE:
            </span>
            <span className="text-slate-300">
              Viewing site perspective of
            </span>
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-2 py-0.5 rounded-md">
              {viewingUser.image ? (
                <img
                  src={viewingUser.image}
                  alt={viewingUser.name}
                  className="w-3.5 h-3.5 rounded-full object-cover border border-white/20"
                />
              ) : null}
              <span className="font-semibold text-white">{viewingUser.name}</span>
              <span className="text-slate-400 text-[10px]">({viewingUser.email})</span>
              <span
                className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                  viewingUser.role === "admin"
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                }`}
              >
                {viewingUser.role}
              </span>
            </div>
            <span className="hidden md:inline text-[11px] text-amber-400/80 italic">
              — State mutations & telemetry are disabled
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          {onSwitchUser && (
            <button
              onClick={onSwitchUser}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-white/10 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-[11px]"
              title="Open User Manager to switch user"
            >
              <Users className="w-3 h-3 text-cyan-400" />
              <span>Switch User</span>
            </button>
          )}

          <button
            onClick={onExit}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition flex items-center gap-1.5 text-[11px] shadow-sm shadow-amber-500/20"
            title="Exit impersonation and return to your admin view"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Exit View Mode</span>
          </button>
        </div>
      </div>
    </div>
  );
}
