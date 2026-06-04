'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canManageFetchSources } from '@/lib/auth/permissions'
import type { LeadFetchRun, LeadFetchSource } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Play, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/utils'

interface FetchSourceDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fetchSourceId: string | null
  onChanged: () => void
}

const RUN_STATUS_META: Record<string, { label: string; cls: string }> = {
  ok: { label: 'OK', cls: 'bg-emerald-500/15 text-emerald-400' },
  partial: { label: 'Partial', cls: 'bg-amber-500/15 text-amber-400' },
  error: { label: 'Error', cls: 'bg-red-500/15 text-red-400' },
  disabled: { label: 'Disabled', cls: 'bg-slate-700 text-slate-400' },
}

export function FetchSourceDetailDialog({
  open,
  onOpenChange,
  fetchSourceId,
  onChanged,
}: FetchSourceDetailDialogProps) {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageFetchSources(profile?.role ?? null)

  const [source, setSource] = useState<LeadFetchSource | null>(null)
  const [runs, setRuns] = useState<LeadFetchRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!fetchSourceId) return
    setLoading(true)
    const [srcRes, runsRes] = await Promise.all([
      supabase
        .from('lead_fetch_sources')
        .select('*, source:sources(id, name, key)')
        .eq('id', fetchSourceId)
        .single(),
      fetch(`/api/integrations/fetch-sources/${fetchSourceId}/runs`).then((r) =>
        r.ok ? r.json() : { runs: [] },
      ),
    ])
    setSource((srcRes.data as LeadFetchSource) ?? null)
    setRuns((runsRes.runs ?? []) as LeadFetchRun[])
    setLoading(false)
  }, [fetchSourceId, supabase])

  useEffect(() => {
    if (open && fetchSourceId) fetchAll()
  }, [open, fetchSourceId, fetchAll])

  async function handleRunNow() {
    if (!fetchSourceId) return
    setRunning(true)
    try {
      const res = await fetch(`/api/integrations/fetch-sources/${fetchSourceId}/run`, {
        method: 'POST',
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Run failed')
        return
      }
      toast.success(
        `Run complete — ${body.items_created} created, ${body.items_skipped} skipped, ${body.items_failed} failed`,
      )
      onChanged()
      fetchAll()
    } catch {
      toast.error('Network error running poll')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{source?.name ?? 'Fetch Source'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Configuration and recent poll runs.
          </DialogDescription>
        </DialogHeader>

        {loading || !source ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Summary ───────────────────────────────────── */}
            <section className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Field label="Endpoint" value={`${source.http_method} ${source.endpoint_url}`} mono />
                <Field label="Poll interval" value={`Every ${source.poll_interval_minutes} min`} />
                <Field label="Ref ID path" value={source.ref_id_path} mono />
                <Field label="Items path" value={source.items_path || '(response is array)'} mono />
                <Field
                  label="Status"
                  value={source.last_status}
                />
                <Field
                  label="Last polled"
                  value={source.last_polled_at ? timeAgo(source.last_polled_at) : 'never'}
                />
              </div>
              {source.last_error && (
                <p className="text-[11px] text-red-300 rounded bg-red-500/10 px-2 py-1">
                  {source.last_error}
                </p>
              )}
            </section>

            {/* ── Run now ───────────────────────────────────── */}
            {canManage && (
              <Button
                onClick={handleRunNow}
                disabled={running}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Run now
              </Button>
            )}

            {/* ── Recent runs ───────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Recent Runs
                </p>
                <button
                  type="button"
                  onClick={fetchAll}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </div>
              {runs.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">No runs yet.</p>
              ) : (
                <div className="rounded-md border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/50 max-h-72 overflow-y-auto">
                  {runs.map((r) => {
                    const meta = RUN_STATUS_META[r.status] ?? RUN_STATUS_META.error
                    return (
                      <div key={r.id} className="px-3 py-2 text-xs flex items-start gap-2">
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}
                        >
                          {r.status === 'ok' ? (
                            <CheckCircle2 className="size-2.5" />
                          ) : (
                            <AlertCircle className="size-2.5" />
                          )}
                          {meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400">
                            {timeAgo(r.started_at)}
                            {r.http_status != null && (
                              <span className="text-slate-600"> · HTTP {r.http_status}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {r.items_fetched} fetched · {r.items_created} created ·{' '}
                            {r.items_skipped} skipped · {r.items_failed} failed
                          </p>
                          {r.error_message && (
                            <p className="text-[10px] text-red-300 truncate mt-0.5">
                              {r.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-slate-300 truncate ${mono ? 'font-mono' : ''}`} title={value}>
        {value}
      </p>
    </div>
  )
}
