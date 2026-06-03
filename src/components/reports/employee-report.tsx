"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { rowsToCSV, downloadCSV } from "@/lib/export/csv";
import { Loader2, Users, ChevronUp, ChevronDown, Minus, Download } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface RepRow {
  id: string;
  name: string;
  role: string;
  totalDeals: number;
  won: number;
  lost: number;
  convRate: number;
  revenueWon: number;
  target: number;
  attainment: number;
  followups: number;
  onTimeFollowups: number;
  onTimeRate: number;
}

type SortKey = keyof Omit<RepRow, "id" | "name" | "role">;

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "totalDeals", label: "Total Deals" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "convRate", label: "Conv. Rate" },
  { key: "revenueWon", label: "Revenue Won" },
  { key: "target", label: "Target" },
  { key: "attainment", label: "Attainment" },
  { key: "followups", label: "Follow-ups" },
  { key: "onTimeFollowups", label: "On-Time FUs" },
  { key: "onTimeRate", label: "On-Time Rate" },
];

function fmtPct(n: number) {
  return `${n}%`;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** First day of a date's month, as YYYY-MM-01 (for monthly target lookup). */
function firstOfMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function EmployeeReport({ visibleIds, range }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RepRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("totalDeals");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const fetchData = useCallback(async () => {
    if (visibleIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const start = range.startDate.toISOString();
    const end = range.endDate.toISOString();

    const [profilesRes, dealsRes, followupsRes, targetsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", visibleIds),
      supabase
        .from("deals")
        .select("assigned_to, status, value")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("assigned_to", visibleIds),
      supabase
        .from("followups")
        .select("created_by, created_at, deal_id, deal:deals(reminder_at)")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("created_by", visibleIds),
      // Monthly revenue targets for every month overlapping the range.
      supabase
        .from("targets")
        .select("profile_id, target_value, period_month")
        .eq("metric", "revenue_won")
        .gte("period_month", firstOfMonthStr(range.startDate))
        .lte("period_month", firstOfMonthStr(range.endDate))
        .in("profile_id", visibleIds),
    ]);

    const profiles = (profilesRes.data ?? []) as {
      id: string;
      full_name: string;
      email: string;
      role: string;
    }[];
    const deals = (dealsRes.data ?? []) as { assigned_to: string; status: string; value: number | null }[];
    const followups = (followupsRes.data ?? []) as unknown as {
      created_by: string;
      created_at: string;
      deal: { reminder_at: string | null } | null;
    }[];
    const targets = (targetsRes.data ?? []) as { profile_id: string; target_value: number }[];

    const repData: Record<string, {
      totalDeals: number; won: number; lost: number; revenueWon: number; target: number;
      followups: number; onTime: number;
    }> = {};

    profiles.forEach((p) => {
      repData[p.id] = { totalDeals: 0, won: 0, lost: 0, revenueWon: 0, target: 0, followups: 0, onTime: 0 };
    });

    deals.forEach((d) => {
      if (d.assigned_to && repData[d.assigned_to]) {
        repData[d.assigned_to].totalDeals++;
        if (d.status === "won") {
          repData[d.assigned_to].won++;
          repData[d.assigned_to].revenueWon += Number(d.value ?? 0);
        }
        if (d.status === "lost") repData[d.assigned_to].lost++;
      }
    });

    // Sum monthly targets across the selected range per rep.
    targets.forEach((t) => {
      if (repData[t.profile_id]) repData[t.profile_id].target += Number(t.target_value ?? 0);
    });

    followups.forEach((fu) => {
      if (fu.created_by && repData[fu.created_by]) {
        repData[fu.created_by].followups++;
        if (fu.deal?.reminder_at) {
          const loggedAt = new Date(fu.created_at).getTime();
          const reminderAt = new Date(fu.deal.reminder_at).getTime();
          if (loggedAt <= reminderAt) repData[fu.created_by].onTime++;
        }
      }
    });

    const built: RepRow[] = profiles.map((p) => {
      const r = repData[p.id] ?? { totalDeals: 0, won: 0, lost: 0, revenueWon: 0, target: 0, followups: 0, onTime: 0 };
      const convRate = r.totalDeals > 0 ? Math.round((r.won / r.totalDeals) * 100) : 0;
      const onTimeRate = r.followups > 0 ? Math.round((r.onTime / r.followups) * 100) : 0;
      const attainment = r.target > 0 ? Math.round((r.revenueWon / r.target) * 100) : 0;
      return {
        id: p.id,
        name: p.full_name || p.email,
        role: p.role,
        totalDeals: r.totalDeals,
        won: r.won,
        lost: r.lost,
        convRate,
        revenueWon: r.revenueWon,
        target: r.target,
        attainment,
        followups: r.followups,
        onTimeFollowups: r.onTime,
        onTimeRate,
      };
    });

    setRows(built);
    setLoading(false);
  }, [visibleIds, range, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "desc" ? -diff : diff;
  });

  function handleExport() {
    const cols = ["name", "role", "totalDeals", "won", "lost", "convRate", "revenueWon", "target", "attainment", "followups", "onTimeFollowups", "onTimeRate"];
    const csv = rowsToCSV(sorted as unknown as Record<string, unknown>[], cols);
    downloadCSV(`employee-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

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
        <Users className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No team members found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
        >
          <Download className="size-3.5" /> Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left">Rep</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-3 text-right cursor-pointer hover:text-slate-300 transition-colors select-none"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1 justify-end">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "desc" ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronUp className="size-3" />
                      )
                    ) : (
                      <Minus className="size-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-200">{row.name}</p>
                    <p className="text-[10px] text-slate-500 capitalize">{row.role}</p>
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-slate-200 font-medium">{row.totalDeals}</td>
                <td className="px-3 py-3 text-right text-primary font-medium">{row.won}</td>
                <td className="px-3 py-3 text-right text-red-400 font-medium">{row.lost}</td>
                <td className="px-3 py-3 text-right text-amber-400 font-medium">{fmtPct(row.convRate)}</td>
                <td className="px-3 py-3 text-right text-slate-200 font-medium">{fmtMoney(row.revenueWon)}</td>
                <td className="px-3 py-3 text-right text-slate-400">{row.target > 0 ? fmtMoney(row.target) : "—"}</td>
                <td className="px-3 py-3 text-right font-medium">
                  {row.target > 0 ? (
                    <span className={row.attainment >= 100 ? "text-primary" : row.attainment >= 60 ? "text-amber-400" : "text-red-400"}>
                      {fmtPct(row.attainment)}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-slate-200">{row.followups}</td>
                <td className="px-3 py-3 text-right text-slate-200">{row.onTimeFollowups}</td>
                <td className="px-3 py-3 text-right text-amber-400 font-medium">{fmtPct(row.onTimeRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
