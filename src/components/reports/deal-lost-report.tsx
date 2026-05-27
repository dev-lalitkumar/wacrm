"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DateRange } from "./report-filters";
import { canViewTeamReports } from "@/lib/auth/permissions";
import { useAuth } from "@/hooks/use-auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Loader2, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

interface LostDeal {
  id: string;
  title: string;
  assigned_to: string | null;
  updated_at: string;
  lost_reason: { reason: string } | null;
  contact: { name: string | null; phone: string } | null;
}

interface ProfileMap {
  [id: string]: string;
}

const REASON_COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#3b82f6", "#06b6d4"];

export function DealLostReport({ visibleIds, range }: Props) {
  const supabase = createClient();
  const { profile } = useAuth();
  const canSeeTeam = canViewTeamReports(profile?.role ?? null);

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<LostDeal[]>([]);
  const [profileNames, setProfileNames] = useState<ProfileMap>({});
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(20);

  useEffect(() => {
    if (visibleIds.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setExpanded(false);
    setPage(20);

    (async () => {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();

      const [dealsRes, profilesRes] = await Promise.all([
        supabase
          .from("deals")
          .select(
            "id, title, assigned_to, updated_at, lost_reason:lost_reasons(reason), contact:contacts(name, phone)"
          )
          .eq("status", "lost")
          .gte("updated_at", start)
          .lte("updated_at", end)
          .in("assigned_to", visibleIds)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", visibleIds),
      ]);

      if (cancelled) return;

      const loadedDeals = (dealsRes.data ?? []) as unknown as LostDeal[];
      const names: ProfileMap = {};
      ((profilesRes.data ?? []) as { id: string; full_name: string; email: string }[]).forEach(
        (p) => { names[p.id] = p.full_name || p.email; }
      );

      setDeals(loadedDeals);
      setProfileNames(names);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [visibleIds, range, supabase]);

  // Aggregations
  const byReason: { reason: string; count: number }[] = [];
  const reasonMap: Record<string, number> = {};
  deals.forEach((d) => {
    const key = d.lost_reason?.reason ?? "Unknown";
    reasonMap[key] = (reasonMap[key] ?? 0) + 1;
  });
  Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => byReason.push({ reason, count }));

  const byRep: { name: string; count: number }[] = [];
  if (canSeeTeam) {
    const repMap: Record<string, number> = {};
    deals.forEach((d) => {
      if (d.assigned_to) repMap[d.assigned_to] = (repMap[d.assigned_to] ?? 0) + 1;
    });
    Object.entries(repMap)
      .sort((a, b) => b[1] - a[1])
      .forEach(([id, count]) => {
        byRep.push({ name: profileNames[id] ?? id, count });
      });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <XCircle className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No lost deals in this period</p>
      </div>
    );
  }

  const visibleDeals = deals.slice(0, page);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-500/15">
          <XCircle className="size-6 text-red-400" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Lost Deals</p>
          <p className="text-3xl font-bold text-red-400">{deals.length}</p>
        </div>
      </div>

      {/* By Reason bar chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <p className="mb-4 text-sm font-semibold text-slate-300">Lost by Reason</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byReason} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="reason"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
              allowDecimals={false}
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
            <Bar dataKey="count" name="Lost" radius={[4, 4, 0, 0]}>
              {byReason.map((entry, idx) => (
                <Cell key={entry.reason} fill={REASON_COLORS[idx % REASON_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* By Rep table (managers/admins/owners only) */}
      {canSeeTeam && byRep.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-sm font-semibold text-slate-300">Lost by Rep</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left">Rep</th>
                <th className="px-4 py-2.5 text-right">Lost Deals</th>
              </tr>
            </thead>
            <tbody>
              {byRep.map((r) => (
                <tr key={r.name} className="border-b border-slate-700/50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-200">{r.name}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-red-400">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deal list — expandable */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="flex w-full items-center justify-between px-4 py-3 border-b border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <p className="text-sm font-semibold text-slate-300">
            View All Lost Deals ({deals.length})
          </p>
          {expanded ? (
            <ChevronUp className="size-4 text-slate-500" />
          ) : (
            <ChevronDown className="size-4 text-slate-500" />
          )}
        </button>

        {expanded && (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 text-left">Contact</th>
                  <th className="px-4 py-2.5 text-left hidden sm:table-cell">Deal</th>
                  <th className="px-4 py-2.5 text-left">Reason</th>
                  {canSeeTeam && <th className="px-4 py-2.5 text-left hidden md:table-cell">Rep</th>}
                  <th className="px-4 py-2.5 text-right hidden lg:table-cell">Date Lost</th>
                </tr>
              </thead>
              <tbody>
                {visibleDeals.map((d) => (
                  <tr key={d.id} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="text-slate-200">
                        {d.contact?.name ?? d.contact?.phone ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell max-w-[160px] truncate">
                      {d.title}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[11px] text-red-400">
                        {d.lost_reason?.reason ?? "—"}
                      </span>
                    </td>
                    {canSeeTeam && (
                      <td className="px-4 py-2.5 text-slate-400 hidden md:table-cell">
                        {d.assigned_to ? (profileNames[d.assigned_to] ?? d.assigned_to) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right text-slate-500 text-xs hidden lg:table-cell">
                      {new Date(d.updated_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {deals.length > page && (
              <div className="px-4 py-3 border-t border-slate-700/50 text-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 20)}
                  className="text-xs text-primary hover:text-primary/80 cursor-pointer"
                >
                  Load more ({deals.length - page} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
