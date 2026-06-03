"use client"

import { Target } from 'lucide-react'
import type { GoalAttainmentBundle } from '@/lib/main-dashboard/types'
import { Skeleton } from '@/components/dashboard/skeleton'

interface GoalAttainmentProps {
  data: GoalAttainmentBundle | null
  loading: boolean
}

function money(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(v)
}

export function GoalAttainment({ data, loading }: GoalAttainmentProps) {
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Monthly Target
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">Won revenue vs target · {monthLabel}</p>
        </div>
      </header>
      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-16 w-full" />
        ) : !data.hasTarget ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No target set for this period.{' '}
            <span className="text-slate-400">Set targets in Settings → Targets.</span>
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-white tabular-nums">{money(data.revenueWon)}</p>
                <p className="text-xs text-slate-500">of {money(data.target)} target</p>
              </div>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  data.attainment >= 100
                    ? 'text-primary'
                    : data.attainment >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {data.attainment}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${
                  data.attainment >= 100
                    ? 'bg-primary'
                    : data.attainment >= 60
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(100, data.attainment)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
