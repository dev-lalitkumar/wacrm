"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { Loader2, Timer, Trophy, AlertTriangle, Clock } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface StageDwell {
  stage: string;
  avgDays: number;
  samples: number;
}
interface AgingRow {
  id: string;
  title: string;
  stage: string;
  daysStuck: number;
}

const DAY = 86_400_000;
const STUCK_DAYS = 14;

function days(ms: number) {
  return Math.max(0, Math.round(ms / DAY));
}

/**
 * Funnel velocity: average time deals spend in each stage (reconstructed from
 * deal_history stage transitions), average days-to-win for the period, and a
 * list of stuck/aging open deals with no stage movement for {STUCK_DAYS}+ days.
 */
export function VelocityReport({ visibleIds, range }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [dwell, setDwell] = useState<StageDwell[]>([]);
  const [avgWinDays, setAvgWinDays] = useState<number | null>(null);
  const [aging, setAging] = useState<AgingRow[]>([]);

  useEffect(() => {
    if (visibleIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();

      const [stagesRes, openRes, wonRes, histRes] = await Promise.all([
        supabase.from("pipeline_stages").select("name, position").order("position"),
        supabase
          .from("deals")
          .select("id, title, created_at, stage:pipeline_stages(name)")
          .eq("status", "open")
          .in("assigned_to", visibleIds),
        supabase
          .from("deals")
          .select("created_at, closed_at")
          .eq("status", "won")
          .gte("closed_at", start)
          .lte("closed_at", end)
          .in("assigned_to", visibleIds),
        supabase
          .from("deal_history")
          .select("deal_id, old_value, new_value, created_at, deal:deals!inner(created_at, assigned_to, status)")
          .eq("field", "stage")
          .in("deal.assigned_to", visibleIds)
          .order("created_at", { ascending: true })
          .limit(5000),
      ]);

      if (cancelled) return;

      const stageOrder = (stagesRes.data ?? []) as { name: string; position: number }[];
      const openDeals = (openRes.data ?? []) as unknown as {
        id: string; title: string | null; created_at: string; stage: { name: string } | null;
      }[];
      const wonDeals = (wonRes.data ?? []) as { created_at: string; closed_at: string | null }[];
      const hist = (histRes.data ?? []) as unknown as {
        deal_id: string; old_value: string | null; new_value: string | null; created_at: string;
        deal: { created_at: string } | null;
      }[];

      // ── Avg days to win ──
      if (wonDeals.length > 0) {
        const total = wonDeals.reduce((s, d) => {
          if (!d.closed_at) return s;
          return s + (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime());
        }, 0);
        setAvgWinDays(days(total / wonDeals.length));
      } else {
        setAvgWinDays(null);
      }

      // ── Per-stage dwell from transitions ──
      const byDeal = new Map<string, typeof hist>();
      for (const h of hist) {
        const arr = byDeal.get(h.deal_id) ?? [];
        arr.push(h);
        byDeal.set(h.deal_id, arr);
      }
      const sums: Record<string, { total: number; n: number }> = {};
      const add = (stage: string | null, ms: number) => {
        if (!stage || ms <= 0) return;
        sums[stage] ??= { total: 0, n: 0 };
        sums[stage].total += ms;
        sums[stage].n += 1;
      };
      const lastChangeAt = new Map<string, number>();
      for (const [dealId, rowsRaw] of byDeal) {
        const rows = rowsRaw;
        const dealCreated = rows[0]?.deal?.created_at;
        // dwell in the very first stage = first transition - deal creation
        if (dealCreated && rows[0]) {
          add(rows[0].old_value, new Date(rows[0].created_at).getTime() - new Date(dealCreated).getTime());
        }
        // dwell in each intermediate stage = next transition - this transition
        for (let i = 0; i < rows.length - 1; i++) {
          add(rows[i].new_value, new Date(rows[i + 1].created_at).getTime() - new Date(rows[i].created_at).getTime());
        }
        lastChangeAt.set(dealId, new Date(rows[rows.length - 1].created_at).getTime());
      }

      const dwellRows: StageDwell[] = stageOrder
        .map((s) => ({
          stage: s.name,
          avgDays: sums[s.name] ? days(sums[s.name].total / sums[s.name].n) : 0,
          samples: sums[s.name]?.n ?? 0,
        }))
        .filter((r) => r.samples > 0);

      // ── Aging open deals (no stage movement for STUCK_DAYS+) ──
      const now = Date.now();
      const agingRows: AgingRow[] = openDeals
        .map((d) => {
          const last = lastChangeAt.get(d.id) ?? new Date(d.created_at).getTime();
          return {
            id: d.id,
            title: d.title || "Untitled deal",
            stage: d.stage?.name ?? "—",
            daysStuck: days(now - last),
          };
        })
        .filter((r) => r.daysStuck >= STUCK_DAYS)
        .sort((a, b) => b.daysStuck - a.daysStuck)
        .slice(0, 20);

      if (!cancelled) {
        setDwell(dwellRows);
        setAging(agingRows);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visibleIds, range, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <Trophy className="size-4" /> Avg Days to Win
          </div>
          <p className="mt-1.5 text-2xl font-bold text-primary">
            {avgWinDays != null ? `${avgWinDays}d` : "—"}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Won deals closed in {range.label}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            <AlertTriangle className={`size-4 ${aging.length > 0 ? "text-orange-400" : ""}`} /> Stuck Deals
          </div>
          <p className={`mt-1.5 text-2xl font-bold ${aging.length > 0 ? "text-orange-400" : "text-slate-200"}`}>
            {aging.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">No movement for {STUCK_DAYS}+ days</p>
        </div>
      </div>

      {/* Avg time in stage */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <div className="border-b border-slate-700 px-4 py-3 flex items-center gap-2">
          <Timer className="size-4 text-primary" />
          <p className="text-sm font-semibold text-slate-300">Average Time in Stage</p>
        </div>
        {dwell.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Not enough stage-movement history yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left">Stage</th>
                <th className="px-4 py-2.5 text-right">Avg Days</th>
                <th className="px-4 py-2.5 text-right">Deals Measured</th>
              </tr>
            </thead>
            <tbody>
              {dwell.map((d) => (
                <tr key={d.stage} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-200">{d.stage}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-200">{d.avgDays}d</td>
                  <td className="px-4 py-2.5 text-right text-slate-400">{d.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Aging deals */}
      {aging.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="border-b border-slate-700 px-4 py-3 flex items-center gap-2">
            <Clock className="size-4 text-orange-400" />
            <p className="text-sm font-semibold text-slate-300">Stuck / Aging Deals</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left">Deal</th>
                <th className="px-4 py-2.5 text-left">Stage</th>
                <th className="px-4 py-2.5 text-right">Days Stuck</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((a) => (
                <tr key={a.id} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-200 truncate max-w-[280px]">{a.title}</td>
                  <td className="px-4 py-2.5 text-slate-400">{a.stage}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-orange-400">{a.daysStuck}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
