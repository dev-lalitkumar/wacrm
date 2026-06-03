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
import { Loader2, MessageSquare } from "lucide-react";
import { FOLLOWUP_OUTCOME_LABELS, type FollowupOutcome } from "@/types";

interface Props {
  visibleIds: string[];
  range: DateRange;
}

type Channel = "whatsapp" | "call" | "email" | "meeting" | "other";

const CHANNEL_COLORS: Record<Channel, string> = {
  whatsapp: "#22c55e",
  call:     "#3b82f6",
  email:    "#eab308",
  meeting:  "#8b5cf6",
  other:    "#94a3b8",
};

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  call:     "Call",
  email:    "Email",
  meeting:  "Meeting",
  other:    "Other",
};

const ALL_CHANNELS: Channel[] = ["whatsapp", "call", "email", "meeting", "other"];

export function FollowupReport({ visibleIds, range }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<{ channel: Channel; count: number }[]>([]);
  const [outcomeData, setOutcomeData] = useState<{ outcome: FollowupOutcome; count: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [onTime, setOnTime] = useState(0);

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

      const { data: followupsData } = await supabase
        .from("followups")
        .select("channel, outcome, created_at, deal_id, deal:deals(reminder_at)")
        .gte("created_at", start)
        .lte("created_at", end)
        .in("created_by", visibleIds);

      if (cancelled) return;

      const counts: Record<string, number> = {};
      const outcomeCounts: Record<string, number> = {};
      let onTimeCnt = 0;

      const allFollowups = (followupsData ?? []) as unknown as Array<{
        channel: string;
        outcome: string | null;
        created_at: string;
        deal_id: string | null;
        deal: { reminder_at: string | null } | null;
      }>;

      allFollowups.forEach((fu) => {
        const ch = fu.channel as Channel;
        counts[ch] = (counts[ch] ?? 0) + 1;
        if (fu.outcome) outcomeCounts[fu.outcome] = (outcomeCounts[fu.outcome] ?? 0) + 1;
        // On-time: logged before or at reminder_at (only for deal-linked followups)
        if (fu.deal_id && fu.deal?.reminder_at) {
          const loggedAt = new Date(fu.created_at).getTime();
          const reminderAt = new Date(fu.deal.reminder_at).getTime();
          if (loggedAt <= reminderAt) onTimeCnt++;
        }
      });

      const totalCount = allFollowups.length;

      const data = ALL_CHANNELS.map((ch) => ({
        channel: ch,
        count: counts[ch] ?? 0,
      })).filter((d) => d.count > 0);

      const outcomes = (Object.keys(FOLLOWUP_OUTCOME_LABELS) as FollowupOutcome[])
        .map((o) => ({ outcome: o, count: outcomeCounts[o] ?? 0 }))
        .filter((d) => d.count > 0)
        .sort((a, b) => b.count - a.count);

      if (!cancelled) {
        setChannelData(data);
        setOutcomeData(outcomes);
        setTotal(totalCount);
        setOnTime(onTimeCnt);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visibleIds, range, supabase]);

  const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 py-16 text-center">
        <MessageSquare className="size-10 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">No follow-ups in this period</p>
      </div>
    );
  }

  const chartData = channelData.map((d) => ({
    name: CHANNEL_LABELS[d.channel],
    count: d.count,
    color: CHANNEL_COLORS[d.channel],
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Follow-ups", value: total, cls: "text-slate-200" },
          { label: "On-Time (Deals)", value: onTime, cls: "text-primary" },
          { label: "On-Time Rate", value: `${onTimeRate}%`, cls: "text-amber-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {c.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <p className="mb-4 text-sm font-semibold text-slate-300">Follow-ups by Channel</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
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
            <Bar dataKey="count" name="Follow-ups" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Channel breakdown table */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2.5 text-left">Channel</th>
              <th className="px-4 py-2.5 text-right">Count</th>
              <th className="px-4 py-2.5 text-right">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {channelData.map((d) => (
              <tr key={d.channel} className="border-b border-slate-700/50 last:border-0">
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CHANNEL_COLORS[d.channel] }}
                  />
                  <span className="text-slate-200 capitalize">
                    {CHANNEL_LABELS[d.channel]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-200">{d.count}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">
                  {total > 0 ? Math.round((d.count / total) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Outcome breakdown */}
      {outcomeData.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
          <div className="border-b border-slate-700 px-4 py-3">
            <p className="text-sm font-semibold text-slate-300">Outcomes</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 text-left">Outcome</th>
                <th className="px-4 py-2.5 text-right">Count</th>
                <th className="px-4 py-2.5 text-right">% of Logged Outcomes</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const outcomeTotal = outcomeData.reduce((s, d) => s + d.count, 0);
                return outcomeData.map((d) => (
                  <tr key={d.outcome} className="border-b border-slate-700/50 last:border-0">
                    <td className="px-4 py-2.5 text-slate-200">{FOLLOWUP_OUTCOME_LABELS[d.outcome]}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-200">{d.count}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {outcomeTotal > 0 ? Math.round((d.count / outcomeTotal) * 100) : 0}%
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
