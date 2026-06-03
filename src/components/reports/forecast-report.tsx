"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { computeStageProbability, type StageLike } from "@/lib/reports/stage-probability";
import { Loader2, DollarSign, TrendingUp, Target, Layers } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface RepForecast {
  id: string;
  name: string;
  openCount: number;
  openValue: number;
  weighted: number;
  target: number;
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Forecast = a snapshot of the *currently open* pipeline weighted by each
 * deal's stage probability, grouped by rep, compared against the period's
 * revenue target. (Open pipeline is forward-looking, so it ignores the
 * created-date range; the target uses the months overlapping the range.)
 */
export function ForecastReport({ visibleIds, range }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RepForecast[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (visibleIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      const firstOfMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

      const [stagesRes, dealsRes, profilesRes, targetsRes] = await Promise.all([
        supabase.from("pipeline_stages").select("id, position").order("position"),
        supabase
          .from("deals")
          .select("assigned_to, value, stage_id")
          .eq("status", "open")
          .in("assigned_to", visibleIds),
        supabase.from("profiles").select("id, full_name, email").in("id", visibleIds),
        supabase
          .from("targets")
          .select("profile_id, target_value")
          .eq("metric", "revenue_won")
          .gte("period_month", firstOfMonth(range.startDate))
          .lte("period_month", firstOfMonth(range.endDate))
          .in("profile_id", visibleIds),
      ]);

      if (cancelled) return;

      const stages = (stagesRes.data ?? []) as StageLike[];
      const deals = (dealsRes.data ?? []) as { assigned_to: string; value: number | null; stage_id: string }[];
      const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null; email: string }[];
      const targets = (targetsRes.data ?? []) as { profile_id: string; target_value: number }[];

      const acc: Record<string, RepForecast> = {};
      profiles.forEach((p) => {
        acc[p.id] = { id: p.id, name: p.full_name || p.email, openCount: 0, openValue: 0, weighted: 0, target: 0 };
      });
      deals.forEach((d) => {
        const r = acc[d.assigned_to];
        if (!r) return;
        const v = Number(d.value ?? 0);
        r.openCount++;
        r.openValue += v;
        r.weighted += v * computeStageProbability(d.stage_id, stages);
      });
      targets.forEach((t) => {
        if (acc[t.profile_id]) acc[t.profile_id].target += Number(t.target_value ?? 0);
      });

      const built = Object.values(acc).sort((a, b) => b.weighted - a.weighted);
      if (!cancelled) { setRows(built); setLoading(false); }
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

  const totalOpen = rows.reduce((s, r) => s + r.openValue, 0);
  const totalWeighted = rows.reduce((s, r) => s + r.weighted, 0);
  const totalTarget = rows.reduce((s, r) => s + r.target, 0);

  if (rows.every((r) => r.openCount === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <Layers className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No open deals to forecast</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Open Pipeline", value: money(totalOpen), icon: <DollarSign className="size-4" />, cls: "text-slate-200" },
          { label: "Weighted Forecast", value: money(totalWeighted), icon: <TrendingUp className="size-4" />, cls: "text-primary" },
          { label: "Period Target", value: totalTarget > 0 ? money(totalTarget) : "—", icon: <Target className="size-4" />, cls: "text-amber-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {c.icon}{c.label}
            </div>
            <p className={`mt-1.5 text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[620px]">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left">Rep</th>
                <th className="px-3 py-3 text-right">Open Deals</th>
                <th className="px-3 py-3 text-right">Open Value</th>
                <th className="px-3 py-3 text-right">Weighted Forecast</th>
                <th className="px-3 py-3 text-right">Target</th>
                <th className="px-3 py-3 text-right">Forecast vs Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.target > 0 ? Math.round((r.weighted / r.target) * 100) : 0;
                return (
                  <tr key={r.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-200">{r.name}</td>
                    <td className="px-3 py-3 text-right text-slate-200">{r.openCount}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{money(r.openValue)}</td>
                    <td className="px-3 py-3 text-right font-medium text-primary">{money(r.weighted)}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{r.target > 0 ? money(r.target) : "—"}</td>
                    <td className="px-3 py-3 text-right font-medium">
                      {r.target > 0 ? (
                        <span className={pct >= 100 ? "text-primary" : pct >= 60 ? "text-amber-400" : "text-red-400"}>{pct}%</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Forecast is a snapshot of all currently open deals weighted by stage probability
        (New ≈ 10% → final stage ≈ 90%). Target reflects the months in the selected period.
      </p>
    </div>
  );
}
