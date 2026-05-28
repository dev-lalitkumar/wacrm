"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Deal, PipelineStage, LostReason, Profile } from "@/types";
import { DealDetailView } from "@/components/pipelines/deal-detail-view";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Search,
  SlidersHorizontal,
  X,
  Trophy,
  XCircle,
  Check,
  Layers,
  Loader2,
  ChevronDown,
  ChevronUp,
  Minus,
  TrendingUp,
  TrendingDown,
  Percent,
} from "lucide-react";
import { FIXED_PIPELINE_ID } from "@/lib/pipeline/constants";
import { useAuth } from "@/hooks/use-auth";
import { canFilterAssignees } from "@/lib/auth/permissions";
import { getAssignableProfiles } from "@/lib/auth/assignable-profiles";

type StatusTab = "all" | "won" | "lost";
type SortKey = "title" | "value" | "closed" | "created";

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClosedDealsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const showAssigneeFilter = canFilterAssignees(profile?.role ?? null);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [lostReasons, setLostReasons] = useState<LostReason[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [assignableProfiles, setAssignableProfiles] = useState<Profile[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [lostReasonFilter, setLostReasonFilter] = useState<string[]>([]);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("closed");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Detail view
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDealId, setDetailDealId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dealsRes, stagesRes, reasonsRes] = await Promise.all([
      supabase
        .from("deals")
        .select(
          "*, contact:contacts(*, contact_tags(tag:tags(*))), assignee:profiles!deals_assigned_to_fkey(*), stage:pipeline_stages(*), lost_reason:lost_reasons(id, reason)"
        )
        .eq("pipeline_id", FIXED_PIPELINE_ID)
        .in("status", ["won", "lost"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", FIXED_PIPELINE_ID)
        .order("position"),
      supabase.from("lost_reasons").select("*").order("sort_order"),
    ]);
    setDeals((dealsRes.data ?? []) as Deal[]);
    setStages((stagesRes.data ?? []) as PipelineStage[]);
    setLostReasons((reasonsRes.data ?? []) as LostReason[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load assignable profiles
  useEffect(() => {
    if (!profile || !showAssigneeFilter) return;
    let cancelled = false;
    (async () => {
      const list = await getAssignableProfiles(
        supabase,
        profile.id,
        profile.role ?? "executive"
      );
      if (!cancelled) setAssignableProfiles(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, showAssigneeFilter, supabase]);

  // ── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const won = deals.filter((d) => d.status === "won");
    const lost = deals.filter((d) => d.status === "lost");
    const wonValue = won.reduce((s, d) => s + Number(d.value || 0), 0);
    const lostValue = lost.reduce((s, d) => s + Number(d.value || 0), 0);
    const total = won.length + lost.length;
    const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0;
    return {
      wonCount: won.length,
      wonValue,
      lostCount: lost.length,
      lostValue,
      winRate,
    };
  }, [deals]);

  // ── Filter + sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = deals;

    // Status tab
    if (statusTab === "won") result = result.filter((d) => d.status === "won");
    if (statusTab === "lost")
      result = result.filter((d) => d.status === "lost");

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((d) => {
        if (d.title.toLowerCase().includes(q)) return true;
        if ((d.notes ?? "").toLowerCase().includes(q)) return true;
        if ((d.contact?.name ?? "").toLowerCase().includes(q)) return true;
        if ((d.contact?.phone ?? "").toLowerCase().includes(q)) return true;
        if ((d.contact?.email ?? "").toLowerCase().includes(q)) return true;
        if ((d.contact?.company ?? "").toLowerCase().includes(q)) return true;
        return false;
      });
    }

    // Assignee
    if (assigneeFilter.length > 0) {
      result = result.filter(
        (d) => d.assigned_to && assigneeFilter.includes(d.assigned_to)
      );
    }

    // Lost reason
    if (lostReasonFilter.length > 0) {
      result = result.filter(
        (d) =>
          d.lost_reason_id && lostReasonFilter.includes(d.lost_reason_id)
      );
    }

    // Sort
    const arr = [...result];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "title") {
        av = (a.title ?? "").toLowerCase();
        bv = (b.title ?? "").toLowerCase();
      } else if (sortKey === "value") {
        av = Number(a.value ?? 0);
        bv = Number(b.value ?? 0);
      } else if (sortKey === "closed") {
        av = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        bv = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      } else {
        av = a.created_at ? new Date(a.created_at).getTime() : 0;
        bv = b.created_at ? new Date(b.created_at).getTime() : 0;
      }
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [deals, statusTab, search, assigneeFilter, lostReasonFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleAssignee(id: string) {
    setAssigneeFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleLostReason(id: string) {
    setLostReasonFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const activeFilterCount =
    (assigneeFilter.length > 0 ? 1 : 0) +
    (lostReasonFilter.length > 0 ? 1 : 0);

  const statusCounts = useMemo(() => {
    const won = deals.filter((d) => d.status === "won").length;
    const lost = deals.filter((d) => d.status === "lost").length;
    return { all: deals.length, won, lost };
  }, [deals]);

  const stagesById = useMemo(() => {
    const m: Record<string, PipelineStage> = {};
    stages.forEach((s) => (m[s.id] = s));
    return m;
  }, [stages]);

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors select-none cursor-pointer"
      >
        {label}
        {sortKey === k ? (
          sortDir === "desc" ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )
        ) : (
          <Minus className="size-3 opacity-30" />
        )}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-slate-800/50"
            />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-slate-800/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-xl font-bold text-white">Closed Deals</h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span>Won</span>
          </div>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.wonCount}{" "}
            <span className="text-xs font-normal text-slate-400">
              · {formatCurrency(stats.wonValue)}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <TrendingDown className="h-4 w-4 text-red-400" />
            <span>Lost</span>
          </div>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.lostCount}{" "}
            <span className="text-xs font-normal text-slate-400">
              · {formatCurrency(stats.lostValue)}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
            <Percent className="h-4 w-4 text-blue-400" />
            <span>Win Rate</span>
          </div>
          <p className="mt-1 text-base font-semibold text-white">
            {stats.winRate}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {(["all", "won", "lost"] as StatusTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStatusTab(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  statusTab === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t === "all" ? "All" : t === "won" ? "Won" : "Lost"}
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                    statusTab === t
                      ? "bg-white/20"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {statusCounts[t]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals…"
              className="pl-8 h-8 w-48 bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>

          {/* Filter popover */}
          {((showAssigneeFilter && assignableProfiles.length > 0) ||
            lostReasons.length > 0) && (
            <Popover>
              <PopoverTrigger
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-8 text-xs font-medium transition-colors cursor-pointer ${
                  activeFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-semibold">
                    {activeFilterCount}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 border-slate-700 bg-slate-900 p-3 space-y-3 max-h-[70vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Filters
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeFilter([]);
                        setLostReasonFilter([]);
                      }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Assignee filter */}
                {showAssigneeFilter && assignableProfiles.length > 0 && (
                  <div className="space-y-1.5 pb-2 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Assignee
                      </p>
                      {assigneeFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setAssigneeFilter([])}
                          className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer flex items-center gap-0.5"
                        >
                          <X className="size-2.5" /> Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {assignableProfiles.map((p) => {
                        const selected = assigneeFilter.includes(p.id);
                        const label = p.full_name || p.email;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleAssignee(p.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            }`}
                          >
                            <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-black/20 text-[9px] font-bold">
                              {(label ?? "?").charAt(0).toUpperCase()}
                            </span>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lost reason filter */}
                {lostReasons.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Lost Reason
                      </p>
                      {lostReasonFilter.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLostReasonFilter([])}
                          className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer flex items-center gap-0.5"
                        >
                          <X className="size-2.5" /> Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {lostReasons.map((lr) => {
                        const selected = lostReasonFilter.includes(lr.id);
                        return (
                          <button
                            key={lr.id}
                            type="button"
                            onClick={() => toggleLostReason(lr.id)}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            }`}
                          >
                            {lr.reason}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {assigneeFilter.map((id) => {
              const p = assignableProfiles.find((x) => x.id === id);
              const label = p?.full_name || p?.email || "Unknown";
              return (
                <span
                  key={`assignee-${id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] text-primary"
                >
                  Assignee: {label}
                  <button
                    type="button"
                    onClick={() => toggleAssignee(id)}
                    className="hover:text-primary/70 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {lostReasonFilter.map((id) => {
              const lr = lostReasons.find((x) => x.id === id);
              return (
                <span
                  key={`lr-${id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] text-primary"
                >
                  Reason: {lr?.reason ?? "Unknown"}
                  <button
                    type="button"
                    onClick={() => toggleLostReason(id)}
                    className="hover:text-primary/70 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
          <Layers className="size-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-400">
            {deals.length === 0
              ? "No closed deals yet"
              : "No deals match the current filters"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Deal" k="title" />
                  </th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Value" k="value" />
                  </th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Lost Reason</th>
                  <th className="px-4 py-3 text-left">Stage at Close</th>
                  {showAssigneeFilter && (
                    <th className="px-4 py-3 text-left">Assignee</th>
                  )}
                  <th className="px-4 py-3 text-right">
                    <SortHeader label="Closed" k="closed" />
                  </th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">
                    <SortHeader label="Created" k="created" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal) => {
                  const stage = stagesById[deal.stage_id];
                  const assignee = deal.assignee as Profile | undefined;
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => {
                        setDetailDealId(deal.id);
                        setDetailOpen(true);
                      }}
                      className="border-b border-slate-700/40 last:border-0 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      {/* Deal title */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100 truncate max-w-[200px]">
                          {deal.title}
                        </p>
                        {deal.notes && (
                          <p className="text-[10px] text-slate-500 line-clamp-1 max-w-[200px]">
                            {deal.notes}
                          </p>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        {deal.contact ? (
                          <div className="min-w-0">
                            <p className="font-medium text-slate-200 truncate max-w-[160px]">
                              {deal.contact.name || deal.contact.phone}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[160px]">
                              {deal.contact.phone}
                              {deal.contact.email
                                ? ` · ${deal.contact.email}`
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Value */}
                      <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                        {formatCurrency(deal.value, deal.currency)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {deal.status === "won" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Check className="size-2.5" /> Won
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                            <X className="size-2.5" /> Lost
                          </span>
                        )}
                      </td>

                      {/* Lost reason */}
                      <td className="px-4 py-3">
                        {deal.lost_reason ? (
                          <span className="text-xs text-slate-400">
                            {deal.lost_reason.reason}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      {/* Stage at close */}
                      <td className="px-4 py-3">
                        {stage ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: `${stage.color}20`,
                              color: stage.color,
                            }}
                          >
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      {showAssigneeFilter && (
                        <td className="px-4 py-3">
                          {assignee ? (
                            <div className="flex items-center gap-2">
                              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                                {(
                                  assignee.full_name ||
                                  assignee.email ||
                                  "?"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-300 truncate max-w-[110px]">
                                {assignee.full_name || assignee.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">
                              Unassigned
                            </span>
                          )}
                        </td>
                      )}

                      {/* Closed date */}
                      <td className="px-4 py-3 text-right text-[11px] text-slate-500 whitespace-nowrap">
                        {fmtDate(deal.updated_at)}
                      </td>

                      {/* Created date */}
                      <td className="px-4 py-3 text-right text-[11px] text-slate-500 hidden lg:table-cell whitespace-nowrap">
                        {fmtDate(deal.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deal Detail View */}
      <DealDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        dealId={detailDealId}
        stages={stages}
        onSaved={loadData}
        onDeleted={loadData}
      />
    </div>
  );
}
