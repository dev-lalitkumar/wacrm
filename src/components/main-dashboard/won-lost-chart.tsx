"use client"

import type { WonLostWeek } from '@/lib/main-dashboard/types'
import { Skeleton } from '@/components/dashboard/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Props {
  data: WonLostWeek[] | null
  loading: boolean
}

export function WonLostChart({ data, loading }: Props) {
  return (
    <div className="h-full rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-sm font-semibold text-white">Won vs Lost</h3>
      <p className="mt-0.5 text-[11px] text-slate-500">Last 8 weeks</p>

      {loading || !data ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : data.every((w) => w.won === 0 && w.lost === 0) ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-slate-500">No won or lost deals in this period</p>
        </div>
      ) : (
        <div className="mt-4 h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="25%">
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#cbd5e1' }}
                itemStyle={{ color: '#e2e8f0' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="won" name="Won" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
