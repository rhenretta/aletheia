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
  Activity,
  AlertCircle,
  DollarSign,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Zap,
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
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [selectedUserForEvents, setSelectedUserForEvents] = useState<EnrichedUser | null>(null);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    } catch {
      setError("Network error loading users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const toggleExpand = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleCopyId = (id: string) => {
    try {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {}
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      } else {
        setError(data.error || "Failed to update user role");
      }
    } catch {
      setError("Network error updating role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleTierChange = async (userId: string, tier: UserTier) => {
    setUpdatingUserId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tier }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
      } else {
        setError(data.error || "Failed to update user tier");
      }
    } catch {
      setError("Network error updating tier");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userToDelete: EnrichedUser) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete user "${userToDelete.name || userToDelete.email}" (${userToDelete.id})?\n\nThis will remove their account record, knowledge graphs, mind-state memory, and usage metrics.`
    );
    if (!confirmDelete) return;

    setDeletingUserId(userToDelete.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch {
      setError("Network error deleting user");
    } finally {
      setDeletingUserId(null);
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
  const subscriberCount = users.filter((u) => u.tier === "subscriber").length;
  const freeCount = users.filter((u) => u.tier !== "subscriber").length;
  const totalMonthlySpend = users.reduce((sum, u) => sum + (u.usage?.period_cost_usd || 0), 0);

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
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-white/10 rounded-2xl shadow-2xl shadow-cyan-950/40 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-slate-900/70">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    User Manager & Roles
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    {users.length} registered
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Manage tiers, inspect compute quota, and view site perspectives.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-white/10 text-slate-300 hover:text-white transition disabled:opacity-40"
                title="Refresh user list"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-white/10 text-slate-400 hover:text-white transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Header Strip */}
          <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="text-slate-400">Total Users</span>
              <span className="font-bold text-white">{users.length}</span>
            </div>
            <div className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-indigo-400" /> Admins
              </span>
              <span className="font-bold text-indigo-300">{adminCount}</span>
            </div>
            <div className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Subscribers
              </span>
              <span className="font-bold text-amber-300">{subscriberCount}</span>
            </div>
            <div className="bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-cyan-400" /> Total Spend
              </span>
              <span className="font-bold text-cyan-300">${totalMonthlySpend.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="px-6 py-3 border-b border-white/5 bg-slate-950 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
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

          {/* Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/10 font-mono text-[11px]">
            <button
              onClick={() => setRoleFilter("all")}
              className={`px-2.5 py-1 rounded-lg transition ${
                roleFilter === "all"
                  ? "bg-slate-800 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({users.length})
            </button>
            <button
              onClick={() => setRoleFilter("admin")}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                roleFilter === "admin"
                  ? "bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              Admins ({adminCount})
            </button>
            <button
              onClick={() => setRoleFilter("subscriber")}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                roleFilter === "subscriber"
                  ? "bg-amber-500/20 text-yellow-300 font-semibold border border-yellow-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-yellow-400" />
              Subscribers ({subscriberCount})
            </button>
            <button
              onClick={() => setRoleFilter("user")}
              className={`px-2.5 py-1 rounded-lg transition ${
                roleFilter === "user"
                  ? "bg-slate-800 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Free ({freeCount})
            </button>
          </div>
        </div>

        {/* User List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-900/60 border border-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No user records match your search filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isCurrent = currentUserId === user.id;
                const isUpdating = updatingUserId === user.id;
                const isExpanded = expandedUserIds.has(user.id);
                const cost = user.usage?.period_cost_usd || 0;
                const limit = user.tier === "subscriber" ? 3.0 : 0.5;
                const percent = Math.min(100, Math.round((cost / limit) * 100));

                return (
                  <div
                    key={user.id}
                    className={`rounded-2xl border transition overflow-hidden ${
                      isExpanded
                        ? "bg-slate-900/90 border-cyan-500/30 shadow-lg shadow-cyan-950/20"
                        : "bg-slate-900/50 hover:bg-slate-900/80 border-white/5 hover:border-white/15"
                    }`}
                  >
                    {/* Primary Row Content */}
                    <div className="p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                      {/* Left: Avatar & Identity */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {user.image ? (
                          <img
                            src={user.image}
                            alt={user.name}
                            className="w-10 h-10 rounded-xl object-cover border border-white/15 shadow-sm flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-900/70 to-indigo-900/70 border border-white/10 flex items-center justify-center text-cyan-300 font-bold text-sm flex-shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                          </div>
                        )}

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-white text-sm truncate max-w-[180px] sm:max-w-[220px]">
                              {user.name || "Anonymous User"}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono truncate max-w-[220px] sm:max-w-[280px]">
                            {user.email}
                          </div>
                        </div>
                      </div>

                      {/* Middle: Badges & Compute Meter */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {/* Interactive Role Badge Toggle */}
                        <button
                          onClick={() => handleRoleChange(user.id, user.role === "admin" ? "user" : "admin")}
                          disabled={isUpdating}
                          className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition flex items-center gap-1 font-semibold ${
                            user.role === "admin"
                              ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/40"
                              : "bg-slate-800/80 text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20"
                          }`}
                          title={`Click to switch role to ${user.role === "admin" ? "User" : "Admin"}`}
                        >
                          {user.role === "admin" ? (
                            <ShieldCheck className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <UserCheck className="w-3 h-3 text-slate-400" />
                          )}
                          <span className="capitalize">{user.role}</span>
                        </button>

                        {/* Interactive Tier Badge Toggle */}
                        <button
                          onClick={() => handleTierChange(user.id, user.tier === "subscriber" ? "free" : "subscriber")}
                          disabled={isUpdating}
                          className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition flex items-center gap-1 font-semibold ${
                            user.tier === "subscriber"
                              ? "bg-amber-500/20 text-yellow-300 border-yellow-500/40 hover:bg-amber-500/30"
                              : "bg-slate-800/80 text-slate-400 border-white/10 hover:text-slate-200 hover:border-white/20"
                          }`}
                          title={`Click to switch tier to ${user.tier === "subscriber" ? "Free" : "Subscriber"}`}
                        >
                          {user.tier === "subscriber" ? (
                            <Sparkles className="w-3 h-3 text-yellow-400" />
                          ) : (
                            <Flame className="w-3 h-3 text-slate-500" />
                          )}
                          <span>{user.tier === "subscriber" ? "Subscriber" : "Free Tier"}</span>
                        </button>

                        {/* Compact Compute Usage Meter */}
                        <div
                          className="hidden md:flex flex-col justify-center bg-slate-950/80 border border-white/5 rounded-xl px-2.5 py-1 text-[11px] font-mono min-w-[105px]"
                          title={`Monthly Compute: $${cost.toFixed(2)} consumed of $${limit.toFixed(2)} allowance (${percent}%)`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Cost</span>
                            <span className="font-bold text-white">${cost.toFixed(2)}</span>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                percent > 90
                                  ? "bg-rose-500"
                                  : percent > 60
                                  ? "bg-amber-400"
                                  : "bg-cyan-400"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions Group */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* View Site as User */}
                        <button
                          onClick={() => {
                            onViewAsUser(user);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-mono font-medium flex items-center gap-1.5 transition"
                          title={`Impersonate ${user.name} in safe read-only perspective`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">View As</span>
                        </button>

                        {/* Activity Events Trigger */}
                        <button
                          onClick={() => setSelectedUserForEvents(user)}
                          className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-750 border border-white/10 text-slate-400 hover:text-white transition"
                          title="View telemetry activity logs"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete User */}
                        {user.id !== currentUserId && (
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === user.id}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/25 text-rose-400 hover:text-rose-200 transition disabled:opacity-50"
                            title={`Permanently delete user record`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Expand / Collapse Details Drawer */}
                        <button
                          onClick={() => toggleExpand(user.id)}
                          className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-750 border border-white/10 text-slate-400 hover:text-white transition"
                          title={isExpanded ? "Collapse telemetry details" : "Expand telemetry details"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Telemetry & Details Drawer */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5 bg-slate-950/60 space-y-3 text-xs font-mono animate-in fade-in duration-150">
                        {/* Detailed Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2.5 space-y-1">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-cyan-400" />
                              <span>Chats</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {user.usage?.total_chat_messages || 0}
                            </div>
                          </div>

                          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2.5 space-y-1">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Compass className="w-3 h-3 text-emerald-400" />
                              <span>Feed Pipelines</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {user.usage?.total_pipeline_runs || 0}
                            </div>
                          </div>

                          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2.5 space-y-1">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-violet-400" />
                              <span>Model Tokens</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {(user.usage?.total_tokens_used || 0).toLocaleString()}
                            </div>
                          </div>

                          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2.5 space-y-1">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Reading Dwell</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              {formatDwellTime(user.usage?.total_dwell_time_ms)}
                            </div>
                          </div>

                          <div className="bg-slate-900/80 border border-white/5 rounded-xl p-2.5 space-y-1">
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <DollarSign className="w-3 h-3 text-cyan-400" />
                              <span>Monthly Cap</span>
                            </div>
                            <div className="font-bold text-white text-sm">
                              ${cost.toFixed(2)}{" "}
                              <span className="text-[10px] text-slate-400 font-normal">
                                / ${limit.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Metadata Footer: ID, Stripe status & Joined date */}
                        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>Account ID:</span>
                            <code className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-slate-300 font-mono text-[10px]">
                              {user.id}
                            </code>
                            <button
                              onClick={() => handleCopyId(user.id)}
                              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition"
                              title="Copy User ID"
                            >
                              {copiedId === user.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            {user.stripe_customer_id && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                                Stripe: {user.stripe_customer_id}
                              </span>
                            )}
                            <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Active {formatRelativeTime(user.last_active_at)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Admins have full access to switch roles, test subscriber quotas, and view perspectives.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition font-medium text-xs font-mono"
          >
            Done
          </button>
        </div>

        {/* Usage Activity Logs Drawer */}
        {selectedUserForEvents && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
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
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
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
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-medium"
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
