"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { rowsToCSV, downloadCSV } from "@/lib/export/csv";
import { Loader2, Activity, Download } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface RepActivity {
  id: string;
  name: string;
  total: number;
  calls: number;
  whatsapp: number;
  email: number;
  meetings: number;
  connected: number;
  connectRate: number;
}

/**
 * Per-rep activity & productivity for the period: how many follow-ups they
 * logged, split by channel, plus how many connected (disposition = connected
 * or interested). For managers to coach on output and quality.
 */
export function ActivityReport({ visibleIds, range }: Props) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RepActivity[]>([]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (visibleIds.length === 0) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    (async () => {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();

      const [profilesRes, fuRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", visibleIds),
        supabase
          .from("followups")
          .select("created_by, channel, outcome")
          .gte("created_at", start)
          .lte("created_at", end)
          .in("created_by", visibleIds),
      ]);

      if (cancelled) return;

      const profiles = (profilesRes.data ?? []) as { id: string; full_name: string | null; email: string }[];
      const fus = (fuRes.data ?? []) as { created_by: string; channel: string; outcome: string | null }[];

      const acc: Record<string, RepActivity> = {};
      profiles.forEach((p) => {
        acc[p.id] = { id: p.id, name: p.full_name || p.email, total: 0, calls: 0, whatsapp: 0, email: 0, meetings: 0, connected: 0, connectRate: 0 };
      });
      fus.forEach((f) => {
        const r = acc[f.created_by];
        if (!r) return;
        r.total++;
        if (f.channel === "call") r.calls++;
        else if (f.channel === "whatsapp") r.whatsapp++;
        else if (f.channel === "email") r.email++;
        else if (f.channel === "meeting") r.meetings++;
        if (f.outcome === "connected" || f.outcome === "interested") r.connected++;
      });

      const built = Object.values(acc)
        .map((r) => ({ ...r, connectRate: r.total > 0 ? Math.round((r.connected / r.total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);

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

  if (rows.every((r) => r.total === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <Activity className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No activity logged in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const cols = ["name", "total", "calls", "whatsapp", "email", "meetings", "connected", "connectRate"];
            downloadCSV(`activity-report-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCSV(rows as unknown as Record<string, unknown>[], cols));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left">Rep</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">Calls</th>
              <th className="px-3 py-3 text-right">WhatsApp</th>
              <th className="px-3 py-3 text-right">Email</th>
              <th className="px-3 py-3 text-right">Meetings</th>
              <th className="px-3 py-3 text-right">Connected</th>
              <th className="px-3 py-3 text-right">Connect Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40">
                <td className="px-4 py-3 font-medium text-slate-200">{r.name}</td>
                <td className="px-3 py-3 text-right font-medium text-slate-200">{r.total}</td>
                <td className="px-3 py-3 text-right text-slate-300">{r.calls}</td>
                <td className="px-3 py-3 text-right text-slate-300">{r.whatsapp}</td>
                <td className="px-3 py-3 text-right text-slate-300">{r.email}</td>
                <td className="px-3 py-3 text-right text-slate-300">{r.meetings}</td>
                <td className="px-3 py-3 text-right text-primary font-medium">{r.connected}</td>
                <td className="px-3 py-3 text-right text-amber-400 font-medium">{r.connectRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
