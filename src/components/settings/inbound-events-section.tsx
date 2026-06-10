'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canViewInboundEvents } from '@/lib/auth/permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InboundEventStatus, InboundSourceType } from '@/lib/ingest/types'

interface InboundEventRow {
  id: string
  source_type: InboundSourceType
  source_ref: string | null
  idempotency_key: string | null
  status: InboundEventStatus
  error_message: string | null
  received_at: string
  processed_at: string | null
  attempt_count: number
  result: {
    contact_id?: string | null
    deal_id?: string | null
    leadgen_id?: string | null
  }
}

const SOURCE_LABELS: Record<InboundSourceType, string> = {
  meta_leadgen: 'Meta Lead Ads',
  integration_webhook: 'Webhook',
  public_form: 'Public Form',
}

const STATUS_BADGE: Record<
  string,
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  success: {
    label: 'Success',
    icon: CheckCircle2,
    cls: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    cls: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    cls: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  },
  skipped: {
    label: 'Skipped',
    icon: AlertCircle,
    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface Props {
  /** When set, only show events for this webhook/form id */
  sourceRef?: string | null
  /** When set, only show this source type */
  sourceType?: InboundSourceType | null
  title?: string
  description?: string
  compact?: boolean
}

export function InboundEventsSection({
  sourceRef = null,
  sourceType = null,
  title = 'Inbound Events',
  description = 'Every webhook and form submission is queued here before processing. Failed events can be retried.',
  compact = false,
}: Props) {
  const { profile } = useAuth()
  const canView = canViewInboundEvents(profile?.role ?? null)

  const [events, setEvents] = useState<InboundEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [filterSource, setFilterSource] = useState<InboundSourceType | 'all'>(
    sourceType ?? 'all',
  )
  const [filterStatus, setFilterStatus] = useState<InboundEventStatus | 'all'>('all')

  const loadEvents = useCallback(
    async (showSpinner = false) => {
      if (!canView) return
      if (showSpinner) setRefreshing(true)
      try {
        const supabase = createClient()
        let query = supabase
          .from('inbound_events')
          .select(
            'id, source_type, source_ref, idempotency_key, status, error_message, received_at, processed_at, attempt_count, result',
          )
          .order('received_at', { ascending: false })
          .limit(compact ? 20 : 50)

        if (sourceRef) query = query.eq('source_ref', sourceRef)
        if (sourceType) query = query.eq('source_type', sourceType)
        else if (filterSource !== 'all') query = query.eq('source_type', filterSource)
        if (filterStatus !== 'all') query = query.eq('status', filterStatus)

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('received_at', since)

        const { data, error } = await query
        if (error) throw error
        setEvents((data ?? []) as InboundEventRow[])
      } catch {
        toast.error('Failed to load inbound events')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [canView, sourceRef, sourceType, filterSource, filterStatus, compact],
  )

  useEffect(() => {
    if (canView) loadEvents()
  }, [canView, loadEvents])

  if (!canView) return null

  async function handleRetry(eventId: string) {
    setRetryingId(eventId)
    try {
      const res = await fetch(`/api/ingest/retry/${eventId}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Retry failed')
        return
      }
      toast.success(body.ok ? 'Event processed' : `Status: ${body.status}`)
      loadEvents()
    } catch {
      toast.error('Network error during retry')
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadEvents(true)}
            disabled={refreshing}
            className="shrink-0 text-slate-400 hover:text-slate-200"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
        {!sourceType && !compact && (
          <div className="flex flex-wrap gap-2 pt-2">
            <select
              value={filterSource}
              onChange={(e) =>
                setFilterSource(e.target.value as InboundSourceType | 'all')
              }
              className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200"
            >
              <option value="all">All sources</option>
              <option value="meta_leadgen">Meta Lead Ads</option>
              <option value="integration_webhook">Webhooks</option>
              <option value="public_form">Public Forms</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as InboundEventStatus | 'all')
              }
              className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No inbound events in the last 30 days.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400">Time</th>
                  {!sourceType && (
                    <th className="px-3 py-2.5 text-left font-medium text-slate-400 hidden sm:table-cell">
                      Source
                    </th>
                  )}
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400 hidden md:table-cell">
                    Records
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400 hidden lg:table-cell">
                    Details
                  </th>
                  {canView && (
                    <th className="px-3 py-2.5 text-right font-medium text-slate-400 w-16" />
                  )}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => {
                  const s = STATUS_BADGE[ev.status] ?? STATUS_BADGE.failed
                  const Icon = s.icon
                  const contactId = ev.result?.contact_id
                  const dealId = ev.result?.deal_id
                  const retryable = ['failed', 'skipped'].includes(ev.status)

                  return (
                    <tr
                      key={ev.id}
                      className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/20'}
                    >
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {timeAgoShort(ev.received_at)}
                      </td>
                      {!sourceType && (
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <span className="text-xs text-slate-300">
                            {SOURCE_LABELS[ev.source_type]}
                          </span>
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
                        >
                          <Icon
                            className={`size-3 ${ev.status === 'processing' ? 'animate-spin' : ''}`}
                          />
                          {s.label}
                        </span>
                        {ev.attempt_count > 1 && (
                          <span className="ml-1 text-[10px] text-slate-500">
                            ×{ev.attempt_count}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <div className="flex flex-wrap gap-2">
                          {contactId && (
                            <Link
                              href={`/contacts?highlight=${contactId}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Contact
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                          {dealId && (
                            <Link
                              href={`/pipelines?deal=${dealId}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Deal
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                          {!contactId && !dealId && (
                            <span className="text-xs text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        {ev.error_message ? (
                          <span className="text-xs text-amber-400 line-clamp-2">
                            {ev.error_message}
                          </span>
                        ) : ev.idempotency_key ? (
                          <code className="text-xs text-slate-500">
                            {ev.idempotency_key.slice(0, 16)}
                            {ev.idempotency_key.length > 16 ? '…' : ''}
                          </code>
                        ) : ev.status === 'success' ? (
                          <Badge variant="secondary" className="text-xs">
                            processed
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      {canView && (
                        <td className="px-3 py-2.5 text-right">
                          {retryable && (
                            <button
                              type="button"
                              onClick={() => handleRetry(ev.id)}
                              disabled={retryingId === ev.id}
                              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer disabled:opacity-50"
                              title="Retry"
                            >
                              {retryingId === ev.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
