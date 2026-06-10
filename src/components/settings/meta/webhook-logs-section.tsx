'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw, CheckCircle2, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface WebhookLog {
  id: string
  leadgen_id: string
  page_id: string | null
  form_id: string | null
  status: 'success' | 'error' | 'skipped'
  contact_id: string | null
  deal_id: string | null
  error_message: string | null
  created_at: string
  contacts?: { name: string | null; phone: string | null } | null
}

const STATUS_BADGE: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  success: {
    label: 'Lead saved',
    icon: CheckCircle2,
    cls: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    cls: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  skipped: {
    label: 'Skipped',
    icon: AlertCircle,
    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
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

export function WebhookLogsSection() {
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meta_webhook_logs')
        .select('*, contacts(name, phone)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setLogs((data ?? []) as WebhookLog[])
    } catch {
      toast.error('Failed to load webhook logs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white">Leadgen Webhook Logs</CardTitle>
            <CardDescription>
              Recent lead events received from Facebook Lead Ads. Last 50 events.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadLogs(true)}
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No lead events received yet. Subscribe a page and map phone or email on a form to start
            capturing leads.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400">Time</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400">Contact</th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400 hidden md:table-cell">
                    Records
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-slate-400 hidden lg:table-cell">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const s = STATUS_BADGE[log.status] ?? STATUS_BADGE.error
                  const Icon = s.icon
                  return (
                    <tr
                      key={log.id}
                      className={
                        idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/20'
                      }
                    >
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {timeAgoShort(log.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}
                        >
                          <Icon className="size-3" />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {log.contacts ? (
                          <div>
                            <div className="text-slate-200">
                              {log.contacts.name ?? '—'}
                            </div>
                            {log.contacts.phone && (
                              <div className="text-xs text-slate-500">{log.contacts.phone}</div>
                            )}
                          </div>
                        ) : log.status === 'success' && log.contact_id ? (
                          <span className="text-slate-500 text-xs">Contact</span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 md:table-cell">
                        <div className="flex flex-wrap gap-2">
                          {log.contact_id && (
                            <Link
                              href={`/contacts?highlight=${log.contact_id}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Contact
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                          {log.deal_id && (
                            <Link
                              href={`/pipelines?deal=${log.deal_id}`}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              Deal
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        {log.error_message ? (
                          <span className="text-xs text-amber-400">{log.error_message}</span>
                        ) : log.status === 'success' ? (
                          <Badge variant="secondary" className="text-xs">
                            contact + deal
                          </Badge>
                        ) : (
                          <code className="text-xs text-slate-500">
                            {log.leadgen_id.slice(0, 12)}…
                          </code>
                        )}
                      </td>
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
