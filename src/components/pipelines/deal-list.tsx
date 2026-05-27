"use client";

import { useMemo, useState } from "react";
import type { Deal, PipelineStage, Profile } from "@/types";
import { Check, X, Layers, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { reminderStatus } from "@/lib/deals/reminder-status";
import { timeAgo } from "@/lib/utils";

export interface DealLastFollowup {
  channel: string;
  created_at: string;
}

interface DealListProps {
  deals: Deal[];
  stages: PipelineStage[];
  onEditDeal: (deal: Deal) => void;
  /** When false, the Assignee column is hidden entirely (executives) */
  showAssignee: boolean;
  /** deal.id → last followup (channel + timestamp). undefined = none */
  lastFollowups?: Record<string, DealLastFollowup | undefined>;
}

type SortKey = "title" | "value" | "reminder" | "created";

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

export function DealList({
  deals,
  stages,
  onEditDeal,
  showAssignee,
  lastFollowups = {},
}: DealListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const stagesById = useMemo(() => {
    const m: Record<string, PipelineStage> = {};
    stages.forEach((s) => (m[s.id] = s));
    return m;
  }, [stages]);

  const sorted = useMemo(() => {
    const arr = [...deals];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "title") {
        av = (a.title ?? "").toLowerCase();
        bv = (b.title ?? "").toLowerCase();
      } else if (sortKey === "value") {
        av = Number(a.value ?? 0);
        bv = Number(b.value ?? 0);
      } else if (sortKey === "reminder") {
        av = a.reminder_at ? new Date(a.reminder_at).getTime() : Infinity;
        bv = b.reminder_at ? new Date(b.reminder_at).getTime() : Infinity;
      } else {
        av = a.created_at ? new Date(a.created_at).getTime() : 0;
        bv = b.created_at ? new Date(b.created_at).getTime() : 0;
      }
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [deals, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

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

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <Layers className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No deals match the current filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left">
                <SortHeader label="Deal" k="title" />
              </th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-left">Stage</th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="Value" k="value" />
              </th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">
                <SortHeader label="Reminder" k="reminder" />
              </th>
              <th className="px-4 py-3 text-left">Last Followup</th>
              {showAssignee && <th className="px-4 py-3 text-left">Assignee</th>}
              <th className="px-4 py-3 text-right hidden lg:table-cell">
                <SortHeader label="Created" k="created" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((deal) => {
              const stage = stagesById[deal.stage_id];
              const rem = reminderStatus(deal.reminder_at);
              const lf = lastFollowups[deal.id];
              const assignee = deal.assignee as Profile | undefined;
              return (
                <tr
                  key={deal.id}
                  onClick={() => onEditDeal(deal)}
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
                          {deal.contact.email ? ` · ${deal.contact.email}` : ""}
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Stage chip */}
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

                  {/* Value */}
                  <td className="px-4 py-3 text-right font-semibold text-primary whitespace-nowrap">
                    {formatCurrency(deal.value, deal.currency)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {deal.status === "won" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <Check className="size-2.5" /> Won
                      </span>
                    )}
                    {deal.status === "lost" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                        <X className="size-2.5" /> Lost
                      </span>
                    )}
                    {(!deal.status || deal.status === "open") && (
                      <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        Open
                      </span>
                    )}
                  </td>

                  {/* Reminder */}
                  <td className="px-4 py-3">
                    {deal.reminder_at && rem ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${rem.cls}`}
                      >
                        {rem.label}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Last followup */}
                  <td className="px-4 py-3">
                    {lf ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 capitalize">
                          {lf.channel}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {timeAgo(lf.created_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Assignee */}
                  {showAssignee && (
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                            {(assignee.full_name || assignee.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-300 truncate max-w-[110px]">
                            {assignee.full_name || assignee.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">Unassigned</span>
                      )}
                    </td>
                  )}

                  {/* Created */}
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
  );
}
