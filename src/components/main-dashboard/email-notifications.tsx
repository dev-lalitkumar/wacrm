"use client"

import { useEffect, useState, useCallback } from 'react'
import { Skeleton } from '@/components/dashboard/skeleton'
import { Mail, ExternalLink } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

interface Notification {
  id: string
  gmail_message_id: string
  from_email: string
  from_name: string | null
  subject: string | null
  snippet: string | null
  contact_id: string | null
  is_read: boolean
  received_at: string
  contact?: { id: string; name?: string; email?: string; phone?: string } | null
}

interface Props {
  /** Whether Gmail is connected (from useGmailStatus) */
  connected: boolean
}

export function EmailNotifications({ connected }: Props) {
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!connected) {
      setLoading(false)
      return
    }
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch(`/api/gmail/notifications?since=${encodeURIComponent(since)}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unread_count ?? 0)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [connected])

  useEffect(() => {
    load()
  }, [load])

  if (!connected) return null

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Recent Emails</h3>
        {unreadCount > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {unreadCount} unread
          </span>
        )}
      </div>

      {loading || !notifications ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-28" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-4 text-center">
          <Mail className="h-8 w-8 text-slate-700" />
          <p className="mt-2 text-sm text-slate-500">No recent emails</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800/60">
          {notifications.slice(0, 5).map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-2.5">
              {/* Icon */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  n.is_read
                    ? 'bg-slate-800 text-slate-500'
                    : 'bg-primary/15 text-primary'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${n.is_read ? 'text-slate-400' : 'font-medium text-slate-200'}`}>
                  {n.subject ?? '(no subject)'}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {n.from_name || n.from_email}
                  {n.contact && (
                    <>
                      {' · '}
                      <Link
                        href="/contacts"
                        className="text-primary hover:underline"
                      >
                        {n.contact.name || n.contact.email}
                      </Link>
                    </>
                  )}
                </p>
                {n.snippet && (
                  <p className="mt-0.5 truncate text-[10px] text-slate-600">
                    {n.snippet}
                  </p>
                )}
              </div>

              {/* Time */}
              <span className="shrink-0 text-[10px] text-slate-600">
                {timeAgo(n.received_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
