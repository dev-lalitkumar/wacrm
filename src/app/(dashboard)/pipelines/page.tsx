"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PipelineStage, Deal, CustomField, Profile } from "@/types";
import { PipelineBoard } from "@/components/pipelines/pipeline-board";
import { DealForm } from "@/components/pipelines/deal-form";
import { DealDetailView } from "@/components/pipelines/deal-detail-view";
import { DealList, type DealLastFollowup } from "@/components/pipelines/deal-list";
import { PipelineAnalytics } from "@/components/pipelines/pipeline-analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Plus,
  Search,
  SlidersHorizontal,
  X,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { FIXED_PIPELINE_ID } from "@/lib/pipeline/constants";
import { useAuth } from "@/hooks/use-auth";
import { canFilterAssignees } from "@/lib/auth/permissions";
import { getAssignableProfiles } from "@/lib/auth/assignable-profiles";

type ReminderTab = "all" | "today" | "missed" | "upcoming";
interface ReminderCounts { all: number; today: number; missed: number; upcoming: number; }

function computeReminderCounts(allDeals: Deal[]): ReminderCounts {
  const now = new Date();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  let today = 0, missed = 0, upcoming = 0;
  allDeals.forEach((d) => {
    if (d.status !== "open" || !d.reminder_at) return;
    const dt = new Date(d.reminder_at);
    if (dt < now) missed++;
    else if (dt <= todayEnd) today++;
    else upcoming++;
  });
  return { all: allDeals.length, today, missed, upcoming };
}

function filterDealsByTab(
  allDeals: Deal[],
  tab: ReminderTab,
  q: string,
  fieldFilters: Record<string, string[]>,
  filterFields: CustomField[],
  assigneeFilter: string[],
): Deal[] {
  const now = new Date();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  let filtered = allDeals;

  // Assignee multi-select filter
  if (assigneeFilter.length > 0) {
    filtered = filtered.filter(
      (d) => d.assigned_to && assigneeFilter.includes(d.assigned_to),
    );
  }

  if (tab !== "all") {
    filtered = filtered.filter((d) => {
      if (d.status !== "open" || !d.reminder_at) return false;
      const dt = new Date(d.reminder_at);
      if (tab === "missed") return dt < now;
      if (tab === "today") return dt >= now && dt <= todayEnd;
      if (tab === "upcoming") return dt > todayEnd;
      return true;
    });
  }

  if (q.trim()) {
    const term = q.trim().toLowerCase();
    filtered = filtered.filter((d) => {
      if (d.title.toLowerCase().includes(term)) return true;
      if ((d.notes ?? "").toLowerCase().includes(term)) return true;
      if ((d.contact?.name ?? "").toLowerCase().includes(term)) return true;
      if ((d.contact?.phone ?? "").toLowerCase().includes(term)) return true;
      if ((d.contact?.email ?? "").toLowerCase().includes(term)) return true;
      if ((d.contact?.company ?? "").toLowerCase().includes(term)) return true;
      if (Object.values(d.custom_data ?? {}).some((v) => String(v ?? "").toLowerCase().includes(term))) return true;
      if (Object.values(d.contact?.custom_data ?? {}).some((v) => String(v ?? "").toLowerCase().includes(term))) return true;
      return false;
    });
  }

  for (const f of filterFields) {
    const selected = fieldFilters[f.id];
    if (!selected || selected.length === 0) continue;
    const isContactField = f.applies_to === "contact";
    filtered = filtered.filter((d) => {
      const raw = isContactField
        ? (d.contact?.custom_data ?? {})[f.id]
        : (d.custom_data ?? {})[f.id];
      if (f.field_type === "file") {
        const hasFile = raw != null && raw !== "";
        return selected[0] === "available" ? hasFile : !hasFile;
      }
      if (f.field_type === "select") return selected.includes(raw as string);
      if (f.field_type === "multi_select") {
        const arr = Array.isArray(raw) ? (raw as string[]) : [];
        return selected.some((v) => arr.includes(v));
      }
      return true;
    });
  }

  return filtered;
}

export default function PipelinesPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const showAssigneeFilter = canFilterAssignees(profile?.role ?? null);

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // View toggle (Kanban / Table) — Kanban default, no persistence per plan
  const [viewMode, setViewMode] = useState<"board" | "table">("board");

  // Assignee filter
  const [assignableProfiles, setAssignableProfiles] = useState<Profile[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);

  // Last-followup map for the table view
  const [lastFollowups, setLastFollowups] = useState<Record<string, DealLastFollowup>>({});

  // Reminder filter state
  const [reminderTab, setReminderTab] = useState<ReminderTab>("today");
  const [reminderCounts, setReminderCounts] = useState<ReminderCounts>({ all: 0, today: 0, missed: 0, upcoming: 0 });
  const [search, setSearch] = useState("");

  // Custom field filter state
  const [dealFilterFields, setDealFilterFields] = useState<CustomField[]>([]);
  const [activeDealFilters, setActiveDealFilters] = useState<Record<string, string[]>>({});
  const [dealDisplayFields, setDealDisplayFields] = useState<CustomField[]>([]);

  // Deal form / detail state
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string>("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDealId, setDetailDealId] = useState<string | null>(null);

  const loadStages = useCallback(async () => {
    const { data } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("pipeline_id", FIXED_PIPELINE_ID)
      .order("position");
    return (data ?? []) as PipelineStage[];
  }, [supabase]);

  const loadDeals = useCallback(async () => {
    const { data } = await supabase
      .from("deals")
      .select("*, contact:contacts(*, contact_tags(tag:tags(*))), assignee:profiles!deals_assigned_to_fkey(*)")
      .eq("pipeline_id", FIXED_PIPELINE_ID)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    return (data ?? []) as Deal[];
  }, [supabase]);

  /** Fetch most-recent followup per deal — used by the table view */
  const loadLastFollowups = useCallback(async (dealIds: string[]) => {
    if (dealIds.length === 0) return {} as Record<string, DealLastFollowup>;
    const { data } = await supabase
      .from("deal_followups")
      .select("deal_id, channel, created_at")
      .in("deal_id", dealIds)
      .order("created_at", { ascending: false });
    const map: Record<string, DealLastFollowup> = {};
    (data ?? []).forEach((row: { deal_id: string; channel: string; created_at: string }) => {
      // First occurrence wins (rows are descending) — skip if already mapped
      if (!map[row.deal_id]) {
        map[row.deal_id] = { channel: row.channel, created_at: row.created_at };
      }
    });
    return map;
  }, [supabase]);

  const fetchDealFilterFields = useCallback(async () => {
    const [dealRes, contactRes, displayRes] = await Promise.all([
      supabase.from("custom_fields").select("*").eq("applies_to", "deal")
        .in("field_type", ["select", "multi_select", "file"]).order("sort_order"),
      supabase.from("custom_fields").select("*").eq("applies_to", "contact")
        .in("field_type", ["select", "multi_select", "file"]).order("sort_order"),
      supabase.from("custom_fields").select("*").eq("applies_to", "deal")
        .order("sort_order").limit(2),
    ]);
    setDealFilterFields([
      ...((dealRes.data ?? []) as CustomField[]),
      ...((contactRes.data ?? []) as CustomField[]),
    ]);
    if (displayRes.data) setDealDisplayFields(displayRes.data as CustomField[]);
  }, [supabase]);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [s, d] = await Promise.all([loadStages(), loadDeals()]);
      if (cancelled) return;
      setStages(s);
      setDeals(d);
      setReminderCounts(computeReminderCounts(d));
      setLoading(false);
      // Background load: last followups (don't block initial render)
      const fuMap = await loadLastFollowups(d.map((x) => x.id));
      if (!cancelled) setLastFollowups(fuMap);
    })();
    return () => { cancelled = true; };
  }, [loadStages, loadDeals, loadLastFollowups]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDealFilterFields();
  }, [fetchDealFilterFields]);

  // Load assignable profiles for the role-scoped Assignee filter
  useEffect(() => {
    if (!profile || !showAssigneeFilter) return;
    let cancelled = false;
    (async () => {
      const list = await getAssignableProfiles(
        supabase,
        profile.id,
        profile.role ?? "executive",
      );
      if (!cancelled) setAssignableProfiles(list);
    })();
    return () => { cancelled = true; };
  }, [profile, showAssigneeFilter, supabase]);

  const refreshDeals = useCallback(async () => {
    const d = await loadDeals();
    setDeals(d);
    setReminderCounts(computeReminderCounts(d));
    const fuMap = await loadLastFollowups(d.map((x) => x.id));
    setLastFollowups(fuMap);
  }, [loadDeals, loadLastFollowups]);

  const handleDealMoved = useCallback(
    async (dealId: string, newStageId: string) => {
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d))
      );
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId);
      if (error) refreshDeals();
    },
    [supabase, refreshDeals],
  );

  const handleAddDeal = useCallback(
    (stageId?: string) => {
      setDefaultStageId(stageId ?? stages[0]?.id ?? "");
      setDealFormOpen(true);
    },
    [stages],
  );

  const handleEditDeal = useCallback((deal: Deal) => {
    setDetailDealId(deal.id);
    setDetailOpen(true);
  }, []);

  const activeDealFilterCount =
    Object.values(activeDealFilters).filter((v) => v.length > 0).length +
    (assigneeFilter.length > 0 ? 1 : 0);

  function toggleAssignee(profileId: string) {
    setAssigneeFilter((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  }

  function toggleDealFilter(fieldId: string, value: string) {
    setActiveDealFilters((prev) => {
      const current = prev[fieldId] ?? [];
      const field = dealFilterFields.find((f) => f.id === fieldId);
      if (field?.field_type === "multi_select") {
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [fieldId]: next };
      }
      return { ...prev, [fieldId]: current.includes(value) ? [] : [value] };
    });
  }

  function clearDealFilter(fieldId: string) {
    setActiveDealFilters((prev) => ({ ...prev, [fieldId]: [] }));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-800" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 w-72 animate-pulse rounded-xl bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Sales Pipeline</h1>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              title="Kanban view"
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "board"
                  ? "bg-slate-800 text-primary"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-slate-800 text-primary"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TableIcon className="size-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
          <Button
            onClick={() => handleAddDeal()}
            disabled={stages.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Reminder filter tabs + search + custom field filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
            {(["all", "today", "missed", "upcoming"] as ReminderTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReminderTab(t)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  reminderTab === t
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  reminderTab === t ? "bg-white/20" : "bg-slate-700 text-slate-400"
                }`}>
                  {reminderCounts[t]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals…"
              className="pl-8 h-8 w-48 bg-slate-900 border-slate-700 text-white text-sm placeholder:text-slate-500"
            />
          </div>
          {(dealFilterFields.length > 0 || (showAssigneeFilter && assignableProfiles.length > 0)) && (
            <Popover>
              <PopoverTrigger
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 h-8 text-xs font-medium transition-colors cursor-pointer ${
                  activeDealFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeDealFilterCount > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-semibold">
                    {activeDealFilterCount}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-72 border-slate-700 bg-slate-900 p-3 space-y-3 max-h-[70vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filters</p>
                  {activeDealFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => { setActiveDealFilters({}); setAssigneeFilter([]); }}
                      className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Assignee filter — Admin/Owner/Manager only */}
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
                              {label.charAt(0).toUpperCase()}
                            </span>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {dealFilterFields.map((f, idx) => {
                  const selected = activeDealFilters[f.id] ?? [];
                  const prevField = dealFilterFields[idx - 1];
                  const showSectionHeader = idx === 0 || (prevField && prevField.applies_to !== f.applies_to);
                  return (
                    <div key={f.id} className="space-y-1.5">
                      {showSectionHeader && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 pt-1">
                          {f.applies_to === "deal" ? "Deal Fields" : "Contact Fields"}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium text-slate-400">{f.field_name}</p>
                        {selected.length > 0 && (
                          <button
                            type="button"
                            onClick={() => clearDealFilter(f.id)}
                            className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer flex items-center gap-0.5"
                          >
                            <X className="size-2.5" /> Clear
                          </button>
                        )}
                      </div>
                      {f.field_type === "file" ? (
                        <div className="flex gap-1.5">
                          {(["available", "unavailable"] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => toggleDealFilter(f.id, v)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                                selected.includes(v)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                              }`}
                            >
                              {v === "available" ? "Available" : "Not Available"}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {((f.field_options?.options ?? []) as string[]).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleDealFilter(f.id, opt)}
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                                selected.includes(opt)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {/* Active filter chips */}
        {activeDealFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {/* Assignee chips */}
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
            {dealFilterFields.map((f) => {
              const selected = activeDealFilters[f.id] ?? [];
              if (selected.length === 0) return null;
              return selected.map((v) => (
                <span
                  key={`${f.id}-${v}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] text-primary"
                >
                  {f.field_name}: {v === "available" ? "Available" : v === "unavailable" ? "Not Available" : v}
                  <button
                    type="button"
                    onClick={() => toggleDealFilter(f.id, v)}
                    className="hover:text-primary/70 cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ));
            })}
          </div>
        )}
      </div>

      {/* Analytics row — both views share this header */}
      <PipelineAnalytics stages={stages} deals={deals} />

      {/* Board or table */}
      {viewMode === "board" ? (
        <PipelineBoard
          stages={stages}
          deals={filterDealsByTab(deals, reminderTab, search, activeDealFilters, dealFilterFields, assigneeFilter)}
          onDealMoved={handleDealMoved}
          onAddDeal={handleAddDeal}
          onEditDeal={handleEditDeal}
          customFields={dealDisplayFields}
        />
      ) : (
        <DealList
          deals={filterDealsByTab(deals, reminderTab, search, activeDealFilters, dealFilterFields, assigneeFilter)}
          stages={stages}
          onEditDeal={handleEditDeal}
          showAssignee={showAssigneeFilter}
          lastFollowups={lastFollowups}
        />
      )}

      {/* Deal Create Form */}
      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        pipelineId={FIXED_PIPELINE_ID}
        stages={stages}
        defaultStageId={defaultStageId}
        onSaved={(newDealId) => {
          refreshDeals();
          setDetailDealId(newDealId);
          setDetailOpen(true);
        }}
      />

      {/* Deal Detail View */}
      <DealDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        dealId={detailDealId}
        stages={stages}
        onSaved={refreshDeals}
        onDeleted={refreshDeals}
      />
    </div>
  );
}
