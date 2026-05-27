'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  canManageWebhooks,
  canRevealWebhookSecret,
} from '@/lib/auth/permissions'
import type { Webhook, WebhookRequest } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/utils'

interface WebhookDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhookId: string | null
  /**
   * Pass-through raw secret when the dialog is opened immediately after
   * webhook creation. Lets us show the secret once without a second
   * fetch. Cleared by the parent when the dialog closes.
   */
  initialRawSecret: string | null
  /** Called after a successful regenerate so the parent can refetch. */
  onChanged: () => void
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ok:              { label: 'OK',             cls: 'bg-emerald-500/15 text-emerald-400' },
  rate_limited:    { label: 'Rate Limited',   cls: 'bg-amber-500/15 text-amber-400' },
  invalid_secret:  { label: 'Invalid Secret', cls: 'bg-red-500/15 text-red-400' },
  bad_payload:     { label: 'Bad Payload',    cls: 'bg-red-500/15 text-red-400' },
  disabled:        { label: 'Disabled',       cls: 'bg-slate-700 text-slate-400' },
  error:           { label: 'Error',          cls: 'bg-red-500/15 text-red-400' },
}

export function WebhookDetailDialog({
  open,
  onOpenChange,
  webhookId,
  initialRawSecret,
  onChanged,
}: WebhookDetailDialogProps) {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageWebhooks(profile?.role ?? null)
  const canReveal = canRevealWebhookSecret(profile?.role ?? null)

  const [webhook, setWebhook] = useState<Webhook | null>(null)
  const [requests, setRequests] = useState<WebhookRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Reveal state — initially populated from `initialRawSecret` (one-shot
  // after create). Re-revealing or regenerating updates this in place.
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!webhookId) return
    setLoading(true)
    const [whRes, reqRes] = await Promise.all([
      supabase
        .from('webhooks')
        .select('*, source:sources(id, name, key), pipeline:pipelines(id, name), stage:pipeline_stages(id, name, color)')
        .eq('id', webhookId)
        .single(),
      supabase
        .from('webhook_requests')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('received_at', { ascending: false })
        .limit(20),
    ])
    setWebhook((whRes.data as Webhook) ?? null)
    setRequests((reqRes.data ?? []) as WebhookRequest[])
    setLoading(false)
  }, [webhookId, supabase])

  useEffect(() => {
    if (open && webhookId) {
      setRevealedSecret(initialRawSecret)
      fetchAll()
    } else if (!open) {
      setRevealedSecret(null)
      setConfirmRegenerate(false)
    }
  }, [open, webhookId, initialRawSecret, fetchAll])

  const webhookUrl =
    typeof window !== 'undefined' && webhookId
      ? `${window.location.origin}/api/integrations/webhook/${webhookId}`
      : webhookId
        ? `/api/integrations/webhook/${webhookId}`
        : ''

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`)
    } catch {
      toast.error(`Couldn't copy ${label.toLowerCase()}`)
    }
  }

  async function handleReveal() {
    if (!webhookId) return
    setRevealing(true)
    try {
      const res = await fetch(`/api/integrations/webhooks/${webhookId}/secret`)
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to reveal secret')
        return
      }
      setRevealedSecret(body.secret as string)
    } catch {
      toast.error('Network error revealing secret')
    } finally {
      setRevealing(false)
    }
  }

  async function handleRegenerate() {
    if (!webhookId) return
    setRegenerating(true)
    try {
      const res = await fetch(
        `/api/integrations/webhooks/${webhookId}/secret`,
        { method: 'POST' },
      )
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to regenerate secret')
        return
      }
      setRevealedSecret(body.secret as string)
      setConfirmRegenerate(false)
      toast.success('New secret generated. Update your integrations.')
      onChanged()
      fetchAll()
    } catch {
      toast.error('Network error regenerating secret')
    } finally {
      setRegenerating(false)
    }
  }

  const curlSample = webhook
    ? `curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Webhook-Secret: ${revealedSecret ?? '<YOUR_SECRET>'}' \\
  -d '${JSON.stringify(buildSamplePayload(webhook), null, 2)
    .split('\n')
    .join('\n     ')}'`
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {webhook?.name ?? 'Webhook Details'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            URL, secret, mappings, and recent requests for this webhook.
          </DialogDescription>
        </DialogHeader>

        {loading || !webhook ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── One-time secret reveal banner (after create) ─── */}
            {initialRawSecret && revealedSecret === initialRawSecret && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                <Sparkles className="size-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong>Your secret is ready.</strong> Copy and save it now — for security, you can re-reveal it later only as an Admin or Owner.
                </div>
              </div>
            )}

            {/* ── URL ─────────────────────────────────────────── */}
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Webhook URL
              </p>
              <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
                <code className="flex-1 text-xs text-slate-200 font-mono break-all">
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(webhookUrl, 'URL')}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer shrink-0"
                  title="Copy URL"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </section>

            {/* ── Secret ──────────────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Secret
                </p>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setConfirmRegenerate((p) => !p)}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    <RefreshCw className="size-3" /> Regenerate
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2">
                <code className="flex-1 text-xs text-slate-200 font-mono break-all">
                  {revealedSecret ?? `${webhook.secret_prefix}${'•'.repeat(24)}`}
                </code>
                {revealedSecret ? (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(revealedSecret, 'Secret')}
                    className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer shrink-0"
                    title="Copy secret"
                  >
                    <Copy className="size-3.5" />
                  </button>
                ) : canReveal ? (
                  <button
                    type="button"
                    onClick={handleReveal}
                    disabled={revealing}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 cursor-pointer shrink-0 disabled:opacity-50"
                    title="Reveal & copy"
                  >
                    {revealing ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Eye className="size-3" />
                    )}
                    Reveal
                  </button>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500">
                    <EyeOff className="size-3" /> Admin or Owner only
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Send this in the <code className="text-slate-400">X-Webhook-Secret</code> header on every request.
              </p>

              {confirmRegenerate && (
                <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2 mt-2">
                  <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="text-red-200 font-medium mb-1">
                      Regenerate this webhook&rsquo;s secret?
                    </p>
                    <p className="text-red-200/80 mb-2">
                      Every integration using the old secret will start failing with 401. You&rsquo;ll need to update them with the new one.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="bg-red-600 text-white hover:bg-red-700"
                      >
                        {regenerating && <Loader2 className="size-3 animate-spin" />}
                        Yes, regenerate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRegenerate(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── cURL example ────────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  cURL example
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlSample, 'cURL example')}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  <Copy className="size-3" /> Copy
                </button>
              </div>
              <pre className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre">
                {curlSample}
              </pre>
            </section>

            {/* ── Mappings (read-only) ────────────────────────── */}
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Field Mappings
              </p>
              <MappingsList webhook={webhook} />
            </section>

            {/* ── Recent requests ─────────────────────────────── */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  Recent Requests
                </p>
                <button
                  type="button"
                  onClick={fetchAll}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </div>
              {requests.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">
                  No requests received yet.
                </p>
              ) : (
                <div className="rounded-md border border-slate-700 bg-slate-800/40 divide-y divide-slate-700/50 max-h-72 overflow-y-auto">
                  {requests.map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.error
                    return (
                      <div key={r.id} className="px-3 py-2 text-xs flex items-start gap-2">
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                          {r.status === 'ok' ? (
                            <CheckCircle2 className="size-2.5" />
                          ) : (
                            <AlertCircle className="size-2.5" />
                          )}
                          {meta.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-400">
                            {timeAgo(r.received_at)}
                            {r.ip_address && (
                              <span className="text-slate-600"> · {r.ip_address}</span>
                            )}
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

// ── Helpers ────────────────────────────────────────────────────

/**
 * Build a synthetic JSON payload that round-trips through the saved
 * field_mappings — letting the admin see the exact shape the endpoint
 * expects. Inverts the mapping: for every target slot with a mapped
 * path, places a placeholder value at that path.
 */
function buildSamplePayload(webhook: Webhook): Record<string, unknown> {
  const sample: Record<string, unknown> = {}
  const m = webhook.field_mappings ?? {}

  function setPath(root: Record<string, unknown>, path: string, value: unknown) {
    const parts = (path.startsWith('$.') ? path.slice(2) : path)
      .split('.')
      .filter(Boolean)
    let cur: Record<string, unknown> = root
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
      cur = cur[p] as Record<string, unknown>
    }
    cur[parts[parts.length - 1]] = value
  }

  for (const [slot, path] of Object.entries(m.contact ?? {})) {
    if (!path) continue
    setPath(sample, path, `<${slot}>`)
  }
  for (const [slot, path] of Object.entries(m.deal ?? {})) {
    if (!path) continue
    setPath(sample, path, `<deal.${slot}>`)
  }
  return Object.keys(sample).length === 0
    ? { example: 'add field mappings to see a sample payload' }
    : sample
}

function MappingsList({ webhook }: { webhook: Webhook }) {
  const contact = Object.entries(webhook.field_mappings?.contact ?? {})
  const deal = Object.entries(webhook.field_mappings?.deal ?? {})

  if (contact.length === 0 && deal.length === 0) {
    return (
      <p className="text-xs text-slate-500 py-2">
        No field mappings configured.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {contact.length > 0 && (
        <div className="rounded-md border border-slate-700/50 bg-slate-800/30 p-2.5">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
            Contact
          </p>
          <div className="space-y-0.5">
            {contact.map(([slot, path]) => (
              <div key={slot} className="grid grid-cols-2 gap-3 text-[11px]">
                <span className="text-slate-300">{slot}</span>
                <code className="text-slate-400 font-mono truncate">{path}</code>
              </div>
            ))}
          </div>
        </div>
      )}
      {deal.length > 0 && (
        <div className="rounded-md border border-slate-700/50 bg-slate-800/30 p-2.5">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
            Deal
          </p>
          <div className="space-y-0.5">
            {deal.map(([slot, path]) => (
              <div key={slot} className="grid grid-cols-2 gap-3 text-[11px]">
                <span className="text-slate-300">{slot}</span>
                <code className="text-slate-400 font-mono truncate">{path}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
