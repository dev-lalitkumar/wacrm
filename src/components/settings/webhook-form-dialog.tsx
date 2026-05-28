'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CustomField,
  Pipeline,
  PipelineStage,
  Profile,
  Source,
  Webhook,
  WebhookFieldMappings,
} from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, Sparkles, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface WebhookFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, dialog opens in edit mode. */
  webhook: Webhook | null
  sources: Source[]
  pipelines: Pipeline[]
  stages: PipelineStage[]
  profiles: Profile[]
  /**
   * Called after a successful save. On create, the raw secret is
   * returned so the parent can show it once. On edit, `rawSecret`
   * is null and the existing secret is unchanged.
   */
  onSaved: (newId: string | null, rawSecret: string | null) => void
}

// ─── Standard slot definitions ──────────────────────────────────
//
// Keys here line up with the JSONB shape declared on WebhookFieldMappings
// (see types/index.ts). Every standard field is required — the user
// must provide a mapping path for it. The `defaultKey` is the sensible
// default dot-notation path that most webhook payloads use.
const CONTACT_STANDARD_SLOTS: {
  slot: string
  label: string
  defaultKey: string
  required: boolean
}[] = [
  { slot: 'name',    label: 'Name',    defaultKey: 'name',    required: true },
  { slot: 'phone',   label: 'Phone',   defaultKey: 'phone',   required: true },
  { slot: 'email',   label: 'Email',   defaultKey: 'email',   required: true },
  { slot: 'company', label: 'Company', defaultKey: 'company', required: true },
]

const DEAL_STANDARD_SLOTS: {
  slot: string
  label: string
  defaultKey: string
  required: boolean
}[] = [
  { slot: 'title',               label: 'Title',               defaultKey: 'title',               required: true },
  { slot: 'value',               label: 'Value',               defaultKey: 'value',               required: true },
  { slot: 'notes',               label: 'Notes',               defaultKey: 'notes',               required: true },
  { slot: 'expected_close_date', label: 'Expected close date', defaultKey: 'expected_close_date', required: true },
]

/** Derive a default mapping key from a custom field name, e.g. "Full Name" → "full_name" */
function defaultKeyForCustomField(fieldName: string): string {
  return fieldName.toLowerCase().replace(/\s+/g, '_')
}

/** Build the default flat mapping for all standard contact + deal slots. */
function buildDefaultMappings(
  includeDeal: boolean,
  contactCFs: CustomField[] = [],
  dealCFs: CustomField[] = [],
): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of CONTACT_STANDARD_SLOTS) {
    m[`contact.${s.slot}`] = s.defaultKey
  }
  for (const f of contactCFs) {
    m[`contact.cf:${f.id}`] = defaultKeyForCustomField(f.field_name)
  }
  if (includeDeal) {
    for (const s of DEAL_STANDARD_SLOTS) {
      m[`deal.${s.slot}`] = s.defaultKey
    }
    for (const f of dealCFs) {
      m[`deal.cf:${f.id}`] = defaultKeyForCustomField(f.field_name)
    }
  }
  return m
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  webhook,
  sources,
  pipelines,
  stages,
  profiles,
  onSaved,
}: WebhookFormDialogProps) {
  const supabase = createClient()
  const isEdit = !!webhook

  // ─── Form state ────────────────────────────────────────────
  const [name, setName] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [createsDeal, setCreatesDeal] = useState(false)
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  /** Flat key→value map. Keys: "contact.<slot>" / "deal.<slot>" / "contact.cf:<uuid>" / "deal.cf:<uuid>". */
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [rrOverride, setRrOverride] = useState(false)
  const [rrMembers, setRrMembers] = useState<string[]>([])
  const [rateLimit, setRateLimit] = useState('60')
  const [saving, setSaving] = useState(false)

  // ─── Loaded data ───────────────────────────────────────────
  const [contactCustomFields, setContactCustomFields] = useState<CustomField[]>([])
  const [dealCustomFields, setDealCustomFields] = useState<CustomField[]>([])

  // Pipeline → stages filter for the stage select
  const stagesForPipeline = stages.filter((s) => s.pipeline_id === pipelineId)

  /** Load custom fields and return them (also sets state). */
  const loadCustomFields = useCallback(async () => {
    const [cRes, dRes] = await Promise.all([
      supabase
        .from('custom_fields')
        .select('*')
        .eq('applies_to', 'contact')
        .order('sort_order'),
      supabase
        .from('custom_fields')
        .select('*')
        .eq('applies_to', 'deal')
        .order('sort_order'),
    ])
    const cfs = (cRes.data ?? []) as CustomField[]
    const dfs = (dRes.data ?? []) as CustomField[]
    setContactCustomFields(cfs)
    setDealCustomFields(dfs)
    return { contactCFs: cfs, dealCFs: dfs }
  }, [supabase])

  // Reset / hydrate when dialog opens or webhook changes.
  // Custom fields are loaded first so defaults include them.
  useEffect(() => {
    if (!open) return

    async function hydrate() {
      const { contactCFs, dealCFs } = await loadCustomFields()

      if (webhook) {
        setName(webhook.name)
        setSourceId(webhook.source_id)
        setIsActive(webhook.is_active)
        setCreatesDeal(webhook.creates_deal)
        setPipelineId(webhook.pipeline_id ?? '')
        setStageId(webhook.stage_id ?? '')
        setRrOverride(webhook.round_robin_override)
        setRrMembers(webhook.round_robin_member_ids ?? [])
        setRateLimit(String(webhook.rate_limit_per_minute))

        // Start from full defaults (standard + custom fields),
        // then overlay any saved mappings from the webhook.
        const defaults = buildDefaultMappings(webhook.creates_deal, contactCFs, dealCFs)
        const flat: Record<string, string> = { ...defaults }
        const m = (webhook.field_mappings ?? {}) as WebhookFieldMappings
        for (const [slot, path] of Object.entries(m.contact ?? {})) {
          flat[`contact.${slot}`] = path
        }
        for (const [slot, path] of Object.entries(m.deal ?? {})) {
          flat[`deal.${slot}`] = path
        }
        setMappings(flat)
      } else {
        // Defaults for the create path — pre-fill all mappings
        setName('')
        setSourceId(sources[0]?.id ?? '')
        setIsActive(true)
        setCreatesDeal(false)
        setPipelineId('')
        setStageId('')
        setRrOverride(false)
        setRrMembers([])
        setRateLimit('60')
        setMappings(buildDefaultMappings(false, contactCFs, dealCFs))
      }
    }

    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, webhook, sources])

  // When user toggles "creates deal", ensure deal default mappings are present
  useEffect(() => {
    if (createsDeal) {
      setMappings((prev) => {
        const withDefaults = { ...prev }
        for (const s of DEAL_STANDARD_SLOTS) {
          const key = `deal.${s.slot}`
          if (!withDefaults[key]) {
            withDefaults[key] = s.defaultKey
          }
        }
        for (const f of dealCustomFields) {
          const key = `deal.cf:${f.id}`
          if (!withDefaults[key]) {
            withDefaults[key] = defaultKeyForCustomField(f.field_name)
          }
        }
        return withDefaults
      })
    }
  }, [createsDeal, dealCustomFields])

  function setMapping(key: string, value: string) {
    setMappings((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRrMember(profileId: string) {
    setRrMembers((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    )
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Webhook name is required')
      return
    }
    if (!sourceId) {
      toast.error('Source is required')
      return
    }
    if (createsDeal && (!pipelineId || !stageId)) {
      toast.error('Pick a pipeline and stage for the new deals')
      return
    }
    const limit = parseInt(rateLimit, 10)
    if (!Number.isFinite(limit) || limit < 1) {
      toast.error('Rate limit must be at least 1')
      return
    }

    // Validate that all required standard fields have a mapping
    const missingContact = CONTACT_STANDARD_SLOTS.filter(
      (s) => s.required && !mappings[`contact.${s.slot}`]?.trim(),
    )
    if (missingContact.length > 0) {
      toast.error(
        `Contact field mapping required: ${missingContact.map((s) => s.label).join(', ')}`,
      )
      return
    }
    if (createsDeal) {
      const missingDeal = DEAL_STANDARD_SLOTS.filter(
        (s) => s.required && !mappings[`deal.${s.slot}`]?.trim(),
      )
      if (missingDeal.length > 0) {
        toast.error(
          `Deal field mapping required: ${missingDeal.map((s) => s.label).join(', ')}`,
        )
        return
      }
    }

    // Re-nest the flat mapping map into the JSONB shape, stripping blanks.
    const nested: WebhookFieldMappings = { contact: {}, deal: {} }
    for (const [k, v] of Object.entries(mappings)) {
      const trimmed = v.trim()
      if (!trimmed) continue
      const [bucket, ...rest] = k.split('.')
      const slot = rest.join('.')
      if (bucket === 'contact' && nested.contact) nested.contact[slot] = trimmed
      else if (bucket === 'deal' && nested.deal) nested.deal[slot] = trimmed
    }
    // Drop empty buckets for tidiness
    if (Object.keys(nested.contact ?? {}).length === 0) delete nested.contact
    if (!createsDeal || Object.keys(nested.deal ?? {}).length === 0) delete nested.deal

    setSaving(true)

    if (isEdit && webhook) {
      const { error } = await supabase
        .from('webhooks')
        .update({
          name: name.trim(),
          source_id: sourceId,
          is_active: isActive,
          creates_deal: createsDeal,
          pipeline_id: createsDeal ? pipelineId : null,
          stage_id: createsDeal ? stageId : null,
          field_mappings: nested,
          round_robin_override: rrOverride,
          round_robin_member_ids: rrMembers,
          rate_limit_per_minute: limit,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhook.id)
      setSaving(false)
      if (error) {
        toast.error('Failed to update webhook')
        return
      }
      toast.success('Webhook updated')
      onOpenChange(false)
      onSaved(webhook.id, null)
      return
    }

    // CREATE — call our API route to generate + encrypt the secret server-side
    try {
      const res = await fetch('/api/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          source_id: sourceId,
          is_active: isActive,
          creates_deal: createsDeal,
          pipeline_id: createsDeal ? pipelineId : null,
          stage_id: createsDeal ? stageId : null,
          field_mappings: nested,
          round_robin_override: rrOverride,
          round_robin_member_ids: rrMembers,
          rate_limit_per_minute: limit,
        }),
      })
      const body = await res.json()
      setSaving(false)
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to create webhook')
        return
      }
      toast.success('Webhook created')
      onOpenChange(false)
      onSaved(body.id as string, body.secret as string)
    } catch {
      setSaving(false)
      toast.error('Network error creating webhook')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Edit Webhook' : 'Create Webhook'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEdit
              ? 'Update the webhook configuration. The secret is unchanged.'
              : 'Configure where leads land and how the incoming payload maps to your CRM fields.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── 1. Basics ─────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Basics
            </p>

            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Website Contact Form"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">Source</Label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">— select —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-200">Active</span>
            </label>
          </section>

          {/* ── 2. What to create ─────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              What to create
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreatesDeal(false)}
                className={`rounded-lg border p-3 text-left text-xs transition-colors cursor-pointer ${
                  !createsDeal
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-semibold">Contact only</div>
                <div className="text-[10px] mt-1 opacity-80">Just record the lead.</div>
              </button>
              <button
                type="button"
                onClick={() => setCreatesDeal(true)}
                className={`rounded-lg border p-3 text-left text-xs transition-colors cursor-pointer ${
                  createsDeal
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                <div className="font-semibold">Contact + Deal</div>
                <div className="text-[10px] mt-1 opacity-80">Open a deal in the pipeline below.</div>
              </button>
            </div>

            {createsDeal && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Pipeline</Label>
                  <select
                    value={pipelineId}
                    onChange={(e) => {
                      setPipelineId(e.target.value)
                      setStageId('') // reset stage on pipeline change
                    }}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                  >
                    <option value="">— select —</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Initial Stage</Label>
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    disabled={!pipelineId}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="">— select —</option>
                    {stagesForPipeline.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* ── 3. Field Mapping ──────────────────────────────── */}
          <section className="space-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Field Mapping
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Map each CRM field to the dot-notation path of the matching key in your incoming JSON payload.
                All standard fields are required.
              </p>
            </div>

            {/* Contact fields */}
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400">Contact</p>
              {CONTACT_STANDARD_SLOTS.map((s) => (
                <MappingRow
                  key={`contact.${s.slot}`}
                  label={s.label}
                  required={s.required}
                  defaultValue={s.defaultKey}
                  value={mappings[`contact.${s.slot}`] ?? ''}
                  onChange={(v) => setMapping(`contact.${s.slot}`, v)}
                />
              ))}
              {contactCustomFields.map((f) => (
                <MappingRow
                  key={`contact.cf:${f.id}`}
                  label={f.field_name}
                  defaultValue={f.field_name.toLowerCase().replace(/\s+/g, '_')}
                  value={mappings[`contact.cf:${f.id}`] ?? ''}
                  onChange={(v) => setMapping(`contact.cf:${f.id}`, v)}
                />
              ))}
            </div>

            {createsDeal && (
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-400">Deal</p>
                {DEAL_STANDARD_SLOTS.map((s) => (
                  <MappingRow
                    key={`deal.${s.slot}`}
                    label={s.label}
                    required={s.required}
                    defaultValue={s.defaultKey}
                    value={mappings[`deal.${s.slot}`] ?? ''}
                    onChange={(v) => setMapping(`deal.${s.slot}`, v)}
                  />
                ))}
                {dealCustomFields.map((f) => (
                  <MappingRow
                    key={`deal.cf:${f.id}`}
                    label={f.field_name}
                    defaultValue={f.field_name.toLowerCase().replace(/\s+/g, '_')}
                    value={mappings[`deal.cf:${f.id}`] ?? ''}
                    onChange={(v) => setMapping(`deal.cf:${f.id}`, v)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── 4. Round-robin override ───────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Assignment
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rrOverride}
                onChange={(e) => setRrOverride(e.target.checked)}
                className="size-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-200">
                Override global round-robin for this webhook
              </span>
            </label>

            {rrOverride && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500">
                  Members in this webhook&rsquo;s rotation. Falls back to the global pool when this list is empty.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {profiles.map((p) => {
                    const selected = rrMembers.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleRrMember(p.id)}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
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
              </div>
            )}
          </section>

          {/* ── 5. Rate limit ─────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Rate limit
            </p>
            <div className="grid gap-2 max-w-xs">
              <Label className="text-slate-300 text-xs">Requests per minute</Label>
              <Input
                type="number"
                min="1"
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
              <p className="text-[11px] text-slate-500">
                Requests over this limit return 429.
              </p>
            </div>
          </section>

          {!isEdit && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
              <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
              <p className="text-xs text-slate-300">
                A unique secret will be generated when you save. You&rsquo;ll see it once — copy and store it safely.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Mapping row — standard + custom fields with reset-to-default ──
function MappingRow({
  label,
  required,
  defaultValue,
  value,
  onChange,
}: {
  label: string
  required?: boolean
  defaultValue: string
  value: string
  onChange: (v: string) => void
}) {
  const isDefault = value === defaultValue
  const isEmpty = !value.trim()

  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center">
      <Label className="text-xs text-slate-300">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultValue}
        className={`bg-slate-900 border-slate-700 text-white text-xs font-mono h-8 ${
          isEmpty && required ? 'border-red-500/50 focus:border-red-500' : ''
        }`}
      />
      <button
        type="button"
        title={isDefault ? 'Already at default' : `Reset to "${defaultValue}"`}
        onClick={() => onChange(defaultValue)}
        disabled={isDefault}
        className="flex items-center justify-center size-8 rounded-md border border-slate-700 bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <RotateCcw className="size-3.5" />
      </button>
    </div>
  )
}
