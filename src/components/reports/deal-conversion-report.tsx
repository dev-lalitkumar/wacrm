"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, TrendingUp, CheckCircle2, XCircle, Layers } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface StageRow {
  name: string;
  position: number;
  count: number;
  color: string;
}

const STAGE_COLORS = ["#3b82f6", "#eab308", "#f97316", "#8b5cf6", "#22c55e"];

export function DealConversionReport({ visibleIds, range }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [stageData, setStageData] = useState<StageRow[]>([]);
  const [wonCount, setWonCount] = useState(0);
  const [lostCount, setLostCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (visibleIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();

      const { data } = await supabase
        .from("deals")
        .select("stage_id, status, stage:pipeline_stages(name, position, color)")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("assigned_to", visibleIds);

      if (cancelled) return;

      const deals = (data ?? []) as unknown as Array<{
        stage_id: string;
        status: string;
        stage: { name: string; position: number; color: string } | null;
      }>;

      // Aggregate by stage
      const stageCounts: Record<string, StageRow> = {};
      let won = 0, lost = 0;

      deals.forEach((d) => {
        if (d.status === "won") won++;
        if (d.status === "lost") lost++;
        const s = d.stage;
        if (s && d.stage_id) {
          if (!stageCounts[d.stage_id]) {
            stageCounts[d.stage_id] = {
              name: s.name,
              position: s.position,
              color: s.color,
              count: 0,
            };
          }
          stageCounts[d.stage_id].count++;
        }
      });

      const sorted = Object.values(stageCounts).sort((a, b) => a.position - b.position);

      if (!cancelled) {
        setStageData(sorted);
        setWonCount(won);
        setLostCount(lost);
        setTotalCount(deals.length);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visibleIds, range, supabase]);

  const convRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <Layers className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No deals in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Deals", value: totalCount, icon: <Layers className="size-4" />, cls: "text-slate-200" },
          { label: "Won", value: wonCount, icon: <CheckCircle2 className="size-4" />, cls: "text-primary" },
          { label: "Lost", value: lostCount, icon: <XCircle className="size-4" />, cls: "text-red-400" },
          { label: "Conversion Rate", value: `${convRate}%`, icon: <TrendingUp className="size-4" />, cls: "text-amber-400" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
          >
            <div className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500`}>
              {c.icon}
              {c.label}
            </div>
            <p className={`mt-1.5 text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart by stage */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <p className="mb-4 text-sm font-semibold text-slate-300">Deals by Stage</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stageData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              itemStyle={{ color: "#94a3b8" }}
            />
            <Bar dataKey="count" name="Deals" radius={[4, 4, 0, 0]}>
              {stageData.map((entry, idx) => (
                <Cell
                  key={entry.name}
                  fill={entry.color || STAGE_COLORS[idx % STAGE_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage breakdown table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 text-left">Stage</th>
              <th className="px-4 py-2.5 text-right">Deals</th>
              <th className="px-4 py-2.5 text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {stageData.map((s) => (
              <tr key={s.name} className="border-b border-slate-700/50 last:border-0">
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-slate-200">{s.name}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-200">{s.count}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">
                  {totalCount > 0 ? Math.round((s.count / totalCount) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
