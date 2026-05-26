"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Pipeline, PipelineStage, Deal, CustomField } from "@/types";
import { PipelineBoard } from "@/components/pipelines/pipeline-board";
import { PipelineSettings } from "@/components/pipelines/pipeline-settings";
import { DealForm } from "@/components/pipelines/deal-form";
import { DealDetailView } from "@/components/pipelines/deal-detail-view";
import { PipelineAnalytics } from "@/components/pipelines/pipeline-analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GitBranch, Plus, ChevronDown, Settings, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { canManagePipelines } from "@/lib/auth/permissions";

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
): Deal[] {
  const now = new Date();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  let filtered = allDeals;

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

  // Apply custom field filters (client-side, all deals are in memory)
  for (const f of filterFields) {
    const selected = fieldFilters[f.id];
    if (!selected || selected.length === 0) continue;
    // Route to the correct data bag based on which entity the field belongs to
    const isContactField = f.applies_to === "contact";
    filtered = filtered.filter((d) => {
      const raw = isContactField
        ? (d.contact?.custom_data ?? {})[f.id]
        : (d.custom_data ?? {})[f.id];
      if (f.field_type === "file") {
        const hasFile = raw != null && raw !== "";
        return selected[0] === "available" ? hasFile : !hasFile;
      }
      if (f.field_type === "select") {
        return selected.includes(raw as string);
      }
      if (f.field_type === "multi_select") {
        const arr = Array.isArray(raw) ? (raw as string[]) : [];
        return selected.some((v) => arr.includes(v));
      }
      return true;
    });
  }

  return filtered;
}

// Spec-defined seed — name and color per the product spec.
const SPEC_DEFAULT_STAGES = [
  { name: "New Lead", color: "#3b82f6", position: 0 }, // blue
  { name: "Qualified", color: "#eab308", position: 1 }, // yellow
  { name: "Proposal Sent", color: "#f97316", position: 2 }, // orange
  { name: "Negotiation", color: "#8b5cf6", position: 3 }, // purple
  { name: "Won", color: "#22c55e", position: 4 }, // green
];

export default function PipelinesPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const isAdmin = canManagePipelines(profile?.role ?? null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Reminder filter state
  const [reminderTab, setReminderTab] = useState<ReminderTab>("today");
  const [reminderCounts, setReminderCounts] = useState<ReminderCounts>({ all: 0, today: 0, missed: 0, upcoming: 0 });
  const [search, setSearch] = useState("");

  // Custom field filter state (deal + contact fields, client-side)
  const [dealFilterFields, setDealFilterFields] = useState<CustomField[]>([]);
  const [activeDealFilters, setActiveDealFilters] = useState<Record<string, string[]>>({});
  // Top-2 deal custom fields for display in cards
  const [dealDisplayFields, setDealDisplayFields] = useState<CustomField[]>([]);

  // Dialog / sheet state
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Deal form state (create-only)
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string>("");

  // Deal detail view state (for viewing/editing existing deals)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDealId, setDetailDealId] = useState<string | null>(null);

  // Guard against double-seeding (React StrictMode double-effect in dev).
  const seedAttempted = useRef(false);

  const loadPipelines = useCallback(async () => {
    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .order("created_at");
    if (error) {
      console.error("Failed to load pipelines:", error.message);
      return [];
    }
    return data ?? [];
  }, [supabase]);

  const loadStages = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipelineId)
        .order("position");
      return data ?? [];
    },
    [supabase],
  );

  const loadDeals = useCallback(
    async (pipelineId: string) => {
      const { data } = await supabase
        .from("deals")
        .select("*, contact:contacts(*, contact_tags(tag:tags(*))), assignee:profiles!deals_assigned_to_fkey(*)")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Deal[];
    },
    [supabase],
  );


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

  const seedDefaultPipeline = useCallback(async (): Promise<Pipeline | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, name: "Sales Pipeline" })
      .select()
      .single();

    if (error || !pipeline) {
      console.error("Failed to seed pipeline:", error?.message);
      return null;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    return pipeline as Pipeline;
  }, [supabase]);

  // Fetch deal custom filter fields once on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDealFilterFields();
  }, [fetchDealFilterFields]);

  // Initial load + seed-if-empty
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let list = await loadPipelines();

      if (list.length === 0 && !seedAttempted.current) {
        seedAttempted.current = true;
        const seeded = await seedDefaultPipeline();
        if (seeded) list = await loadPipelines();
      }

      if (cancelled) return;
      setPipelines(list);
      if (list.length > 0) {
        setSelectedPipelineId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id,
        );
      } else {
        setSelectedPipelineId("");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPipelines, seedDefaultPipeline]);

  // Load stages + deals whenever selected pipeline changes.
  // Clearing on no-selection is a legitimate sync with URL/prop
  // state; the load completion uses async setters inside promise
  // callbacks (not synchronous in the effect body).
  useEffect(() => {
    if (!selectedPipelineId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStages([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeals([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [s, d] = await Promise.all([
        loadStages(selectedPipelineId),
        loadDeals(selectedPipelineId),
      ]);
      if (cancelled) return;
      setStages(s);
      setDeals(d);
      setReminderCounts(computeReminderCounts(d));
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPipelineId, loadStages, loadDeals]);

  const refreshPipelines = useCallback(async () => {
    const list = await loadPipelines();
    setPipelines(list);
    if (list.length === 0) setSelectedPipelineId("");
    else if (!list.some((p) => p.id === selectedPipelineId))
      setSelectedPipelineId(list[0].id);
  }, [loadPipelines, selectedPipelineId]);

  const refreshStages = useCallback(async () => {
    if (!selectedPipelineId) return;
    setStages(await loadStages(selectedPipelineId));
  }, [loadStages, selectedPipelineId]);

  const refreshDeals = useCallback(async () => {
    if (!selectedPipelineId) return;
    const d = await loadDeals(selectedPipelineId);
    setDeals(d);
    setReminderCounts(computeReminderCounts(d));
  }, [loadDeals, selectedPipelineId]);

  const handleDealMoved = useCallback(
    async (dealId: string, newStageId: string) => {
      // Optimistic update — board already animated; just persist.
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)),
      );
      const { error } = await supabase
        .from("deals")
        .update({ stage_id: newStageId })
        .eq("id", dealId);
      if (error) {
        toast.error("Failed to move deal");
        refreshDeals();
      }
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

  async function handleCreatePipeline() {
    const name = newPipelineName.trim();
    if (!name) return;
    setCreating(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setCreating(false);
      return;
    }

    const { data: pipeline, error } = await supabase
      .from("pipelines")
      .insert({ user_id: user.id, name })
      .select()
      .single();

    if (error || !pipeline) {
      toast.error("Failed to create pipeline");
      setCreating(false);
      return;
    }

    const stagesPayload = SPEC_DEFAULT_STAGES.map((s) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      position: s.position,
    }));
    await supabase.from("pipeline_stages").insert(stagesPayload);

    setNewPipelineName("");
    setNewPipelineOpen(false);
    setSelectedPipelineId(pipeline.id);
    await refreshPipelines();
    setCreating(false);
    toast.success("Pipeline created");
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  const activeDealFilterCount = Object.values(activeDealFilters).filter((v) => v.length > 0).length;

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
          {[1, 2, 3, 4, 5].map((i) => (
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
        <div className="flex items-center gap-3">
          {/* Pipeline selector dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 transition-colors data-[popup-open]:bg-slate-800"
            >
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="font-semibold">
                {selectedPipeline?.name ?? "Select Pipeline"}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 border-slate-700 bg-slate-900 text-slate-200"
            >
              {pipelines.length === 0 && (
                <DropdownMenuItem disabled className="text-slate-500">
                  No pipelines yet
                </DropdownMenuItem>
              )}
              {pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className={
                    p.id === selectedPipelineId
                      ? "text-primary"
                      : "text-slate-300"
                  }
                >
                  <GitBranch className="mr-2 h-3.5 w-3.5" />
                  {p.name}
                </DropdownMenuItem>
              ))}
              {isAdmin && selectedPipeline && (
                <>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem
                    onClick={() => setSettingsOpen(true)}
                    className="text-slate-300"
                  >
                    <Settings className="mr-2 h-3.5 w-3.5" />
                    Manage Pipelines
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setNewPipelineOpen(true)}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Pipeline
            </Button>
          )}
          <Button
            onClick={() => handleAddDeal()}
            disabled={!selectedPipelineId || stages.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Reminder filter tabs + search + custom field filters */}
      {pipelines.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
              {(["all","today","missed","upcoming"] as ReminderTab[]).map((t) => (
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
            {dealFilterFields.length > 0 && (
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
                  className="w-72 border-slate-700 bg-slate-900 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filters</p>
                    {activeDealFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveDealFilters({})}
                        className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
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
      )}

      {/* Board */}
      {pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-20">
          <GitBranch className="h-12 w-12 text-slate-600" />
          <h3 className="mt-4 text-lg font-medium text-white">
            No pipelines yet
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            {isAdmin ? "Create a pipeline to start tracking deals" : "No pipelines have been created yet"}
          </p>
          {isAdmin && (
            <Button
              onClick={() => setNewPipelineOpen(true)}
              className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create Pipeline
            </Button>
          )}
        </div>
      ) : (
        <>
          <PipelineAnalytics stages={stages} deals={deals} />
          <PipelineBoard
            stages={stages}
            deals={filterDealsByTab(deals, reminderTab, search, activeDealFilters, dealFilterFields)}
            onDealMoved={handleDealMoved}
            onAddDeal={handleAddDeal}
            onEditDeal={handleEditDeal}
            customFields={dealDisplayFields}
          />
        </>
      )}

      {/* New Pipeline Dialog — admin only */}
      <Dialog open={isAdmin && newPipelineOpen} onOpenChange={setNewPipelineOpen}>
        <DialogContent className="sm:max-w-sm bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">New Pipeline</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-slate-300">Pipeline Name</Label>
            <Input
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder="e.g., Enterprise Sales"
              className="mt-2 bg-slate-800 border-slate-700 text-white"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePipeline();
              }}
            />
            <p className="mt-2 text-xs text-slate-400">
              Default stages (New Lead → Won) will be created automatically.
            </p>
          </div>
          <DialogFooter className="bg-slate-900/50 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setNewPipelineOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePipeline}
              disabled={creating || !newPipelineName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? "Creating..." : "Create Pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Settings */}
      {selectedPipeline && (
        <PipelineSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          pipeline={selectedPipeline}
          stages={stages}
          onPipelinesChanged={refreshPipelines}
          onStagesChanged={refreshStages}
          onCreateNewPipeline={() => {
            setSettingsOpen(false);
            setNewPipelineOpen(true);
          }}
        />
      )}

      {/* Deal Create Form */}
      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        pipelineId={selectedPipelineId}
        stages={stages}
        defaultStageId={defaultStageId}
        onSaved={(newDealId) => {
          refreshDeals();
          setDetailDealId(newDealId);
          setDetailOpen(true);
        }}
      />

      {/* Deal Detail View (view / edit existing deal) */}
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
