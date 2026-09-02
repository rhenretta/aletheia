"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Eye,
  Search,
  RefreshCw,
  X,
  Clock,
  MessageSquare,
  Sparkles,
  Compass,
  Check,
  Activity,
  AlertCircle,
  ExternalLink,
  DollarSign,
  CreditCard,
} from "lucide-react";
import { AppUser, UserRole, UserTier, UserUsageMetrics } from "@/core/types/contracts";

interface EnrichedUser extends AppUser {
  usage?: UserUsageMetrics;
}

interface UserManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAsUser: (user: AppUser) => void;
  currentUserId?: string;
}

export default function UserManagerModal({
  isOpen,
  onClose,
  onViewAsUser,
  currentUserId,
}: UserManagerModalProps) {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user" | "subscriber">("all");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [selectedUserForEvents, setSelectedUserForEvents] = useState<EnrichedUser | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to load users");
      }
    } catch (err) {
      setError("Network error fetching users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
      } else {
        alert(data.error || "Failed to update user role");
      }
    } catch (err) {
      alert("Failed to update user role due to a network error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleTierChange = async (userId: string, newTier: UserTier) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier: newTier }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, tier: newTier } : u))
        );
      } else {
        alert(data.error || "Failed to update user tier");
      }
    } catch (err) {
      alert("Failed to update user tier due to a network error");
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === "all" ||
      u.role === roleFilter ||
      (roleFilter === "subscriber" && u.tier === "subscriber");
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter((u) => u.role === "admin").length;
  const standardCount = users.filter((u) => u.role === "user").length;
  const subscriberCount = users.filter((u) => u.tier === "subscriber").length;

  const formatDwellTime = (ms: number = 0) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = (minutes / 60).toFixed(1);
    return `${hours}h`;
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-slate-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  User Manager & Roles
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {users.length} Users
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage user levels (user/admin), inspect real-time usage metrics, and view site perspectives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-850 border border-white/10 text-slate-300 hover:text-white transition disabled:opacity-40"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-850 border border-white/10 text-slate-400 hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Role Filters */}
        <div className="px-6 py-3 border-b border-white/5 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl px-3 py-1.5 w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, or id..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full text-xs"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setRoleFilter("all")}
              className={`px-3 py-1 rounded-lg transition font-mono ${
                roleFilter === "all"
                  ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter("admin")}
              className={`px-3 py-1 rounded-lg transition font-mono flex items-center gap-1.5 ${
                roleFilter === "admin"
                  ? "bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3 h-3 text-indigo-400" />
              Admins ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter("user")}
              className={`px-3 py-1 rounded-lg transition font-mono flex items-center gap-1.5 ${
                roleFilter === "user"
                  ? "bg-slate-700/50 text-slate-200 font-semibold border border-slate-600"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3 h-3 text-slate-400" />
              Users ({standardCount})
            </button>
            <button
              onClick={() => setRoleFilter("subscriber")}
              className={`px-3 py-1 rounded-lg transition font-mono flex items-center gap-1.5 ${
                roleFilter === "subscriber"
                  ? "bg-amber-500/20 text-yellow-300 font-semibold border border-yellow-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
              Subscribers ({subscriberCount})
            </button>
          </div>
        </div>

        {/* User List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-slate-900/60 border border-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No users found matching your criteria.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredUsers.map((user) => {
                const isCurrent = currentUserId === user.id;
                const isUpdating = updatingUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/15 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* User Identity Column */}
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-md"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10 flex items-center justify-center text-cyan-300 font-bold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">{user.name}</span>
                          {user.tier === "subscriber" ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-yellow-300 border border-yellow-500/40 flex items-center gap-1 font-semibold">
                              <Sparkles className="w-2.5 h-2.5 text-yellow-400" />
                              Subscriber
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/10 font-medium">
                              Free
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                          <span>ID: {user.id}</span>
                          <span>•</span>
                          <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Usage Metrics Column */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-950/60 border border-white/5 p-2.5 rounded-xl text-xs font-mono">
                      <div className="space-y-0.5" title="Total conversational turns">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                          <span>Chats</span>
                        </div>
                        <div className="font-bold text-white">
                          {user.usage?.total_chat_messages || 0}
                        </div>
                      </div>

                      <div className="space-y-0.5" title="Feed curation pipeline queries">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                          <Compass className="w-3 h-3 text-emerald-400" />
                          <span>Feeds</span>
                        </div>
                        <div className="font-bold text-white">
                          {user.usage?.total_pipeline_runs || 0}
                        </div>
                      </div>

                      <div className="space-y-0.5" title="Estimated epistemic model tokens">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                          <Sparkles className="w-3 h-3 text-violet-400" />
                          <span>Tokens</span>
                        </div>
                        <div className="font-bold text-white">
                          {(user.usage?.total_tokens_used || 0).toLocaleString()}
                        </div>
                      </div>

                      <div className="space-y-0.5" title="Estimated compute cost in current monthly cycle">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                          <DollarSign className="w-3 h-3 text-cyan-400" />
                          <span>Month $</span>
                        </div>
                        <div className="font-bold text-white">
                          ${(user.usage?.period_cost_usd || 0).toFixed(2)}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                            /{user.tier === "subscriber" ? "3.00" : "0.50"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-0.5" title="Passive reading dwell time">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Dwell</span>
                        </div>
                        <div className="font-bold text-white">
                          {formatDwellTime(user.usage?.total_dwell_time_ms)}
                        </div>
                      </div>
                    </div>

                    {/* Role & Tier Controllers & Actions */}
                    <div className="flex items-center gap-2.5 justify-end">
                      {/* Tier Selector Toggle */}
                      <div className="flex items-center rounded-xl bg-slate-950 border border-white/10 p-1" title="User subscription tier">
                        <button
                          onClick={() => handleTierChange(user.id, "free")}
                          disabled={isUpdating}
                          className={`px-2 py-1 rounded-lg text-xs font-mono transition ${
                            user.tier !== "subscriber"
                              ? "bg-slate-800 text-slate-200 font-semibold shadow-sm"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          Free
                        </button>
                        <button
                          onClick={() => handleTierChange(user.id, "subscriber")}
                          disabled={isUpdating}
                          className={`px-2 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1 ${
                            user.tier === "subscriber"
                              ? "bg-amber-500/20 text-yellow-300 border border-yellow-500/40 font-semibold shadow-sm"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <Sparkles className="w-3 h-3 text-yellow-400" />
                          <span>Sub</span>
                        </button>
                      </div>
                      {/* Role Selector Toggle */}
                      <div className="flex items-center rounded-xl bg-slate-950 border border-white/10 p-1">
                        <button
                          onClick={() => handleRoleChange(user.id, "user")}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1 ${
                            user.role === "user"
                              ? "bg-slate-800 text-slate-200 font-semibold shadow-sm"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>User</span>
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, "admin")}
                          disabled={isUpdating}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition flex items-center gap-1 ${
                            user.role === "admin"
                              ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-500/30"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Admin</span>
                        </button>
                      </div>

                      {/* View Site as Another User (Read-Only Mode) */}
                      <button
                        onClick={() => {
                          onViewAsUser(user);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-mono font-medium flex items-center gap-1.5 transition shadow-sm"
                        title={`View site perspective as ${user.name} in read-only mode`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View As</span>
                      </button>

                      {/* Activity Events Logs Trigger */}
                      <button
                        onClick={() => setSelectedUserForEvents(user)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-white/10 text-slate-300 hover:text-white transition"
                        title="View usage event history"
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div>
            Admins have full access to User Manager, DevTools, and can view site perspectives.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition font-medium"
          >
            Done
          </button>
        </div>

        {/* Recent Events Sub-Modal */}
        {selectedUserForEvents && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg bg-slate-950 border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-white text-sm">
                    Usage Activity Log: {selectedUserForEvents.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedUserForEvents(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 font-mono text-xs">
                {selectedUserForEvents.usage?.recent_events &&
                selectedUserForEvents.usage.recent_events.length > 0 ? (
                  selectedUserForEvents.usage.recent_events.map((evt, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                              evt.type === "chat"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : evt.type === "pipeline"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : evt.type === "telemetry"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {evt.type}
                          </span>
                          <span className="text-slate-300 text-xs">{evt.detail || "Event logged"}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(evt.timestamp)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No recent events recorded for this user.
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedUserForEvents(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
