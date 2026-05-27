"use client"

import type { RecentFollowup } from '@/lib/main-dashboard/types'
import { timeAgo } from '@/lib/utils'
import { Skeleton } from '@/components/dashboard/skeleton'
import { PhoneCall, Mail, Video, MessageSquare, MoreHorizontal, ClipboardList } from 'lucide-react'
import type { ComponentType } from 'react'

interface Props {
  data: RecentFollowup[] | null
  loading: boolean
}

const CHANNEL_META: Record<
  string,
  { icon: ComponentType<{ className?: string }>; color: string }
> = {
  whatsapp: { icon: MessageSquare, color: 'text-green-400 bg-green-400/15' },
  call: { icon: PhoneCall, color: 'text-blue-400 bg-blue-400/15' },
  email: { icon: Mail, color: 'text-amber-400 bg-amber-400/15' },
  meeting: { icon: Video, color: 'text-purple-400 bg-purple-400/15' },
  other: { icon: MoreHorizontal, color: 'text-slate-400 bg-slate-700' },
}

export function RecentFollowups({ data, loading }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Recent Followups</h3>
      </div>

      {loading || !data ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-4 text-center">
          <ClipboardList className="h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm text-slate-500">No recent followups</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800/60">
          {data.map((f) => {
            const meta = CHANNEL_META[f.channel] ?? CHANNEL_META.other
            const Icon = meta.icon
            return (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                {/* Channel icon */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {f.dealTitle}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {f.contactName ?? 'Unknown'}
                    {f.creatorName ? ` · by ${f.creatorName}` : ''}
                  </p>
                </div>

                {/* Time + channel badge */}
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 capitalize">
                    {f.channel}
                  </span>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {timeAgo(f.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
