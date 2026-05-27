"use client"

import Link from 'next/link'
import type { UpcomingReminder } from '@/lib/main-dashboard/types'
import { reminderStatus } from '@/lib/deals/reminder-status'
import { Skeleton } from '@/components/dashboard/skeleton'
import { Bell, CheckCircle2 } from 'lucide-react'

interface Props {
  data: UpcomingReminder[] | null
  loading: boolean
}

export function UpcomingReminders({ data, loading }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Upcoming Reminders</h3>
      </div>

      {loading || !data ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-4 text-center">
          <CheckCircle2 className="h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm text-slate-500">No upcoming reminders</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800/60">
          {data.map((r) => {
            const chip = reminderStatus(r.reminderAt)
            return (
              <li key={r.id}>
                <Link
                  href="/pipelines"
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-slate-800/40 -mx-2 px-2 rounded-lg"
                >
                  {/* Stage dot */}
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: r.stageColor
                        ? `${r.stageColor}20`
                        : '#334155',
                    }}
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: r.stageColor ?? '#64748b',
                      }}
                    />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {r.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.contactName ?? 'No contact'}
                      {r.stageName ? ` · ${r.stageName}` : ''}
                    </p>
                  </div>

                  {/* Reminder chip */}
                  {chip && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${chip.cls}`}
                    >
                      {chip.label}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
