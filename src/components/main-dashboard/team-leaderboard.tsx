"use client"

import { useState } from 'react'
import type { LeaderboardRow } from '@/lib/main-dashboard/types'
import { Skeleton } from '@/components/dashboard/skeleton'
import { Trophy, ChevronDown, ChevronUp, Minus } from 'lucide-react'

interface Props {
  data: LeaderboardRow[] | null
  loading: boolean
}

type SortKey = 'name' | 'openDeals' | 'wonThisMonth' | 'valueWon' | 'followupsThisWeek'

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)
}

export function TeamLeaderboard({ data, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('wonThisMonth')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = data
    ? [...data].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (typeof av === 'string' && typeof bv === 'string') {
          const cmp = av.localeCompare(bv)
          return sortDir === 'desc' ? -cmp : cmp
        }
        const cmp = (av as number) > (bv as number) ? 1 : (av as number) < (bv as number) ? -1 : 0
        return sortDir === 'desc' ? -cmp : cmp
      })
    : null

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors select-none cursor-pointer"
      >
        {label}
        {sortKey === k ? (
          sortDir === 'desc' ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronUp className="size-3" />
          )
        ) : (
          <Minus className="size-3 opacity-30" />
        )}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Team Leaderboard</h3>
        <span className="ml-auto text-[10px] text-slate-500">This month</span>
      </div>

      {loading || !sorted ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          No team members to display
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 text-left">
                  <SortHeader label="Name" k="name" />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortHeader label="Open" k="openDeals" />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortHeader label="Won" k="wonThisMonth" />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortHeader label="Value Won" k="valueWon" />
                </th>
                <th className="px-3 py-2 text-right">
                  <SortHeader label="Followups" k="followupsThisWeek" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => (
                <tr
                  key={row.profileId}
                  className="border-b border-slate-800/40 last:border-0"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-medium">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200 max-w-[140px]">
                          {idx === 0 && sorted.length > 1 && row.wonThisMonth > 0
                            ? `🏆 ${row.name}`
                            : row.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {row.openDeals}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">
                    {row.wonThisMonth}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                    {formatCurrency(row.valueWon)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">
                    {row.followupsThisWeek}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
