"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { Loader2, Layers } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface SourceRow {
  name: string;
  total: number;
  won: number;
  wonRevenue: number;
  convRate: number;
}

const DAY = 86_400_000;

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Lead-source ROI: per source, how many deals it produced, how many were won,
 * the won revenue, and the conversion rate — so owners can see which sources
 * actually pay off. Scoped to the period (by deal creation) and visible reps.
 */
export function SourceRoiReport({ visibleIds, range }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [avgWinDays, setAvgWinDays] = useState<Record<string, number>>({});

  useEffect(() => {
    if (visibleIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();

      const { data } = await supabase
        .from("deals")
        .select("status, value, created_at, closed_at, source:sources(name)")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("assigned_to", visibleIds);

      if (cancelled) return;

      const deals = (data ?? []) as unknown as {
        status: string; value: number | null; created_at: string; closed_at: string | null;
        source: { name: string } | null;
      }[];

      const acc: Record<string, SourceRow & { _winMs: number; _winN: number }> = {};
      deals.forEach((d) => {
        const name = d.source?.name ?? "Unknown";
        acc[name] ??= { name, total: 0, won: 0, wonRevenue: 0, convRate: 0, _winMs: 0, _winN: 0 };
        const r = acc[name];
        r.total++;
        if (d.status === "won") {
          r.won++;
          r.wonRevenue += Number(d.value ?? 0);
          if (d.closed_at) {
            r._winMs += new Date(d.closed_at).getTime() - new Date(d.created_at).getTime();
            r._winN++;
          }
        }
      });

      const winDaysMap: Record<string, number> = {};
      const built = Object.values(acc).map((r) => {
        r.convRate = r.total > 0 ? Math.round((r.won / r.total) * 100) : 0;
        if (r._winN > 0) winDaysMap[r.name] = Math.round(r._winMs / r._winN / DAY);
        return { name: r.name, total: r.total, won: r.won, wonRevenue: r.wonRevenue, convRate: r.convRate };
      }).sort((a, b) => b.wonRevenue - a.wonRevenue || b.total - a.total);

      if (!cancelled) { setRows(built); setAvgWinDays(winDaysMap); setLoading(false); }
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

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <Layers className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No deals in this period</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-3 py-3 text-right">Deals</th>
              <th className="px-3 py-3 text-right">Won</th>
              <th className="px-3 py-3 text-right">Conv. Rate</th>
              <th className="px-3 py-3 text-right">Won Revenue</th>
              <th className="px-3 py-3 text-right">Avg Days to Win</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium text-slate-200">{r.name}</td>
                <td className="px-3 py-3 text-right text-slate-200">{r.total}</td>
                <td className="px-3 py-3 text-right text-primary font-medium">{r.won}</td>
                <td className="px-3 py-3 text-right text-amber-400 font-medium">{r.convRate}%</td>
                <td className="px-3 py-3 text-right text-slate-200 font-medium">{money(r.wonRevenue)}</td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {avgWinDays[r.name] != null ? `${avgWinDays[r.name]}d` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
