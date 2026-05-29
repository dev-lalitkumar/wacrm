"use client"

import Link from 'next/link'
import { Bell, AlertTriangle, Clock, CalendarClock } from 'lucide-react'
import type { ReminderCountsBundle } from '@/lib/main-dashboard/types'
import { Skeleton } from '@/components/dashboard/skeleton'

interface ReminderCountsProps {
  data: ReminderCountsBundle | null
  loading: boolean
}

export function ReminderCounts({ data, loading }: ReminderCountsProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Reminders</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Open deal reminders overview
        </p>
      </header>
      <div className="p-5">
        {loading || !data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/pipelines"
              className="rounded-lg bg-slate-800/50 p-3 transition-colors hover:bg-slate-800"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                <CalendarClock className="h-3.5 w-3.5 text-blue-400" />
                <span>Today</span>
              </div>
              <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                {data.today}
              </p>
            </Link>
            <Link
              href="/pipelines"
              className="rounded-lg bg-slate-800/50 p-3 transition-colors hover:bg-slate-800"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                <AlertTriangle className={`h-3.5 w-3.5 ${data.missed > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                <span className={data.missed > 0 ? 'text-red-400' : undefined}>Missed</span>
              </div>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${data.missed > 0 ? 'text-red-400' : 'text-white'}`}>
                {data.missed}
              </p>
            </Link>
            <Link
              href="/pipelines"
              className="rounded-lg bg-slate-800/50 p-3 transition-colors hover:bg-slate-800"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Upcoming</span>
              </div>
              <p className="mt-1 text-lg font-semibold text-white tabular-nums">
                {data.upcoming}
              </p>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
