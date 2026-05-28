'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  canManageWebhooks,
  canViewWebhooks,
} from '@/lib/auth/permissions'
import type {
  Profile,
  RoundRobinConfig,
  Source,
  Webhook,
} from '@/types'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Loader2,
  Pencil,
  Eye,
  Trash2,
  Webhook as WebhookIcon,
  Users,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/utils'
import { WebhookFormDialog } from './webhook-form-dialog'
import { WebhookDetailDialog } from './webhook-detail-dialog'

export function IntegrationsManager() {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageWebhooks(profile?.role ?? null)
  const canView = canViewWebhooks(profile?.role ?? null)

  // ─── Loaded data ────────────────────────────────────────────────
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [rrConfig, setRrConfig] = useState<RoundRobinConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // ─── Global RR draft state ──────────────────────────────────────
  const [rrEnabled, setRrEnabled] = useState(false)
  const [rrMembers, setRrMembers] = useState<string[]>([])
  const [savingRr, setSavingRr] = useState(false)

  // ─── Dialog state ───────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [detailWebhookId, setDetailWebhookId] = useState<string | null>(null)
  const [deleteWebhook, setDeleteWebhook] = useState<Webhook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<{
    webhookId: string
    raw: string
  } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [whRes, srcRes, profRes, rrRes] = await Promise.all([
      supabase
        .from('webhooks')
        .select('*, source:sources(id, name, key), pipeline:pipelines(id, name), stage:pipeline_stages(id, name, color)')
        .order('created_at', { ascending: false }),
      supabase.from('sources').select('*').order('sort_order'),
      supabase
        .from('profiles')
        .select('id, full_name, email, role, is_active, created_at, user_id')
        .eq('is_active', true)
        .order('full_name'),
      supabase.from('round_robin_config').select('*').eq('id', 1).single(),
    ])

    setWebhooks((whRes.data ?? []) as Webhook[])
    setSources((srcRes.data ?? []) as Source[])
    setProfiles((profRes.data ?? []) as Profile[])

    const rr = (rrRes.data ?? null) as RoundRobinConfig | null
    setRrConfig(rr)
    setRrEnabled(rr?.enabled ?? false)
    setRrMembers(rr?.member_ids ?? [])

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll()
  }, [fetchAll])

  if (!canView) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-6 text-center text-sm text-slate-400">
        You don&rsquo;t have access to Integrations.
      </div>
    )
  }

  async function saveRoundRobin() {
    if (!canManage) return
    setSavingRr(true)
    const { error } = await supabase
      .from('round_robin_config')
      .update({
        enabled: rrEnabled,
        member_ids: rrMembers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
    setSavingRr(false)
    if (error) {
      toast.error('Failed to save round-robin config')
      return
    }
    toast.success('Round-robin saved')
    fetchAll()
  }

  function toggleRrMember(profileId: string) {
    setRrMembers((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    )
  }

  async function confirmDelete() {
    if (!deleteWebhook) return
    setDeleting(true)
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', deleteWebhook.id)
    setDeleting(false)
    if (error) {
      toast.error('Failed to delete webhook')
      return
    }
    toast.success('Webhook deleted')
    setDeleteWebhook(null)
    fetchAll()
  }

  // Next assignee preview for the global pool (informational only —
  // helps the admin see who's up next without firing a request).
  const nextRrAssignee = (() => {
    if (!rrEnabled || rrMembers.length === 0) return null
    const idx = ((rrConfig?.last_index ?? -1) + 1) % rrMembers.length
    const p = profiles.find((x) => x.id === rrMembers[idx])
    return p ? (p.full_name || p.email) : null
  })()

  return (
    <div className="space-y-6">
      {/* ── Card 1: Global round-robin ────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-4">
        <div className="flex items-start gap-3">
          <Users className="size-5 shrink-0 text-primary mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">
              Global Round-Robin Assignment
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Default rotation pool for every webhook. Individual webhooks can opt to override with their own list.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rrEnabled}
            onChange={(e) => setRrEnabled(e.target.checked)}
            disabled={!canManage}
            className="size-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
          />
          <span className="text-sm text-slate-200">
            Enable global round-robin assignment
          </span>
        </label>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-2">
            Members in rotation
          </p>
          {profiles.length === 0 ? (
            <p className="text-xs text-slate-500">No active users found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {profiles.map((p) => {
                const selected = rrMembers.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => canManage && toggleRrMember(p.id)}
                    disabled={!canManage}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      selected
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className={`size-3.5 shrink-0 rounded-sm border ${selected ? 'bg-primary border-primary' : 'border-slate-600'}`}>
                      {selected && <Check className="size-3 text-primary-foreground" />}
                    </span>
                    <span className="truncate">{p.full_name || p.email}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {nextRrAssignee && (
          <p className="text-xs text-slate-500">
            Next assignee:{' '}
            <span className="text-slate-300 font-medium">{nextRrAssignee}</span>
          </p>
        )}

        {canManage && (
          <Button
            onClick={saveRoundRobin}
            disabled={savingRr}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {savingRr && <Loader2 className="size-4 animate-spin" />}
            Save Round-Robin
          </Button>
        )}
      </div>

      {/* ── Card 2: Webhooks ──────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        <div className="flex items-center justify-between p-4 border-b border-slate-700/60">
          <div className="flex items-start gap-3">
            <WebhookIcon className="size-5 shrink-0 text-primary mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-white">Webhooks</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingest leads from external forms, ad platforms, and integrations.
              </p>
            </div>
          </div>
          {canManage && (
            <Button
              onClick={() => {
                setEditingWebhook(null)
                setFormOpen(true)
              }}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" /> Add Webhook
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            {canManage
              ? 'No webhooks yet. Add one to start ingesting leads.'
              : 'No webhooks defined.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {webhooks.map((wh) => (
              <li
                key={wh.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {wh.name}
                    </span>
                    {wh.source && (
                      <span className="inline-flex items-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                        {wh.source.name}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        wh.is_active
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-slate-700 text-slate-500'
                      }`}
                    >
                      {wh.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {wh.creates_deal && (
                      <span className="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-400">
                        Creates Deal
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Created {timeAgo(wh.created_at)}
                    {wh.creates_deal && wh.pipeline && ` · ${wh.pipeline.name}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailWebhookId(wh.id)}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                    title="View details"
                  >
                    <Eye className="size-3.5" />
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWebhook(wh)
                          setFormOpen(true)
                        }}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteWebhook(wh)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-400 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhook create/edit dialog */}
      <WebhookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        webhook={editingWebhook}
        sources={sources}
        profiles={profiles}
        onSaved={(newId, rawSecret) => {
          fetchAll()
          if (rawSecret && newId) {
            // Pop the detail dialog open with the one-time secret reveal
            setCreatedSecret({ webhookId: newId, raw: rawSecret })
            setDetailWebhookId(newId)
          }
        }}
      />

      {/* Webhook detail dialog */}
      <WebhookDetailDialog
        open={!!detailWebhookId}
        onOpenChange={(o) => {
          if (!o) {
            setDetailWebhookId(null)
            setCreatedSecret(null)
          }
        }}
        webhookId={detailWebhookId}
        initialRawSecret={
          createdSecret?.webhookId === detailWebhookId ? createdSecret.raw : null
        }
        onChanged={fetchAll}
      />

      {/* Delete confirm */}
      {deleteWebhook && (
        <DeleteWebhookConfirm
          webhook={deleteWebhook}
          deleting={deleting}
          onCancel={() => setDeleteWebhook(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// Delete confirm — typed-name verification (mirrors custom-fields-manager)
// ───────────────────────────────────────────────────────────────
function DeleteWebhookConfirm({
  webhook,
  deleting,
  onCancel,
  onConfirm,
}: {
  webhook: Webhook
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const match = typed === webhook.name

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">Delete Webhook?</h3>
        <p className="text-sm text-slate-400 mt-1">
          This permanently removes the webhook. The endpoint will immediately stop accepting requests. Already-ingested contacts and deals are kept. Type the webhook&rsquo;s name to confirm:
        </p>
        <p className="mt-3 rounded-md bg-slate-800/60 px-2 py-1 font-mono text-sm text-slate-300">
          {webhook.name}
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type the name…"
          autoFocus
          className="mt-2 h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!match || deleting}
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <Loader2 className="size-4 animate-spin" />}
            Delete Webhook
          </Button>
        </div>
      </div>
    </div>
  )
}
