'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CustomField,
  FetchHeader,
  FetchQueryParam,
  LeadFetchSource,
  Profile,
  Source,
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
import { Loader2, Check, Plus, Trash2, FlaskConical, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { PollSummary } from '@/lib/integrations/fetch-engine'

interface FetchSourceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, dialog opens in edit mode. */
  fetchSource: LeadFetchSource | null
  sources: Source[]
  profiles: Profile[]
  onSaved: () => void
}

const CONTACT_STANDARD_SLOTS = [
  { slot: 'name', label: 'Name', defaultKey: 'name' },
  { slot: 'phone', label: 'Phone', defaultKey: 'phone' },
  { slot: 'email', label: 'Email', defaultKey: 'email' },
  { slot: 'company', label: 'Company', defaultKey: 'company' },
]

const DEAL_STANDARD_SLOTS = [
  { slot: 'title', label: 'Title', defaultKey: 'title' },
  { slot: 'value', label: 'Value', defaultKey: 'value' },
  { slot: 'notes', label: 'Notes', defaultKey: 'notes' },
  { slot: 'expected_close_date', label: 'Expected close date', defaultKey: 'expected_close_date' },
]

const INTERVAL_OPTIONS = [1, 5, 10, 20]

function defaultKeyForCustomField(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_')
}

export function FetchSourceFormDialog({
  open,
  onOpenChange,
  fetchSource,
  sources,
  profiles,
  onSaved,
}: FetchSourceFormDialogProps) {
  const supabase = createClient()
  const isEdit = !!fetchSource

  // ─── Form state ────────────────────────────────────────────
  const [name, setName] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [createsDeal, setCreatesDeal] = useState(true)
  const [endpointUrl, setEndpointUrl] = useState('')
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST'>('GET')
  const [headers, setHeaders] = useState<FetchHeader[]>([])
  const [queryParams, setQueryParams] = useState<FetchQueryParam[]>([])
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [itemsPath, setItemsPath] = useState('')
  const [refIdPath, setRefIdPath] = useState('$.id')
  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [pollInterval, setPollInterval] = useState(10)
  const [rrOverride, setRrOverride] = useState(false)
  const [rrMembers, setRrMembers] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<PollSummary | null>(null)

  // ─── Loaded data ───────────────────────────────────────────
  const [contactCustomFields, setContactCustomFields] = useState<CustomField[]>([])
  const [dealCustomFields, setDealCustomFields] = useState<CustomField[]>([])

  const loadCustomFields = useCallback(async () => {
    const [cRes, dRes] = await Promise.all([
      supabase.from('custom_fields').select('*').eq('applies_to', 'contact').order('sort_order'),
      supabase.from('custom_fields').select('*').eq('applies_to', 'deal').order('sort_order'),
    ])
    setContactCustomFields((cRes.data ?? []) as CustomField[])
    setDealCustomFields((dRes.data ?? []) as CustomField[])
  }, [supabase])

  // Reset / hydrate when the dialog opens.
  useEffect(() => {
    if (!open) return
    setTestResult(null)

    async function hydrate() {
      await loadCustomFields()

      if (fetchSource) {
        setName(fetchSource.name)
        setSourceId(fetchSource.source_id)
        setIsActive(fetchSource.is_active)
        setCreatesDeal(fetchSource.creates_deal)
        setEndpointUrl(fetchSource.endpoint_url)
        setHttpMethod(fetchSource.http_method)
        setQueryParams(fetchSource.query_params ?? [])
        setBodyTemplate(
          fetchSource.body_template ? JSON.stringify(fetchSource.body_template, null, 2) : '',
        )
        setItemsPath(fetchSource.items_path ?? '')
        setRefIdPath(fetchSource.ref_id_path)
        setPollInterval(fetchSource.poll_interval_minutes)
        setRrOverride(fetchSource.round_robin_override)
        setRrMembers(fetchSource.round_robin_member_ids ?? [])

        // Flatten saved field_mappings into the row editor shape.
        const flat: Record<string, string> = {}
        const m = (fetchSource.field_mappings ?? {}) as WebhookFieldMappings
        for (const [slot, path] of Object.entries(m.contact ?? {})) flat[`contact.${slot}`] = path
        for (const [slot, path] of Object.entries(m.deal ?? {})) flat[`deal.${slot}`] = path
        setMappings(flat)

        // Headers are encrypted at rest — fetch the decrypted copy for editing.
        try {
          const res = await fetch(`/api/integrations/fetch-sources/${fetchSource.id}`)
          if (res.ok) {
            const body = await res.json()
            setHeaders((body.headers ?? []) as FetchHeader[])
          } else {
            setHeaders([])
          }
        } catch {
          setHeaders([])
        }
      } else {
        // Create defaults.
        setName('')
        setSourceId(sources[0]?.id ?? '')
        setIsActive(true)
        setCreatesDeal(true)
        setEndpointUrl('')
        setHttpMethod('GET')
        setHeaders([])
        setQueryParams([])
        setBodyTemplate('')
        setItemsPath('')
        setRefIdPath('$.id')
        setPollInterval(10)
        setRrOverride(false)
        setRrMembers([])
        setMappings({
          'contact.name': 'name',
          'contact.phone': 'phone',
          'contact.email': 'email',
        })
      }
    }

    hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchSource, sources])

  function setMapping(key: string, value: string) {
    setMappings((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRrMember(id: string) {
    setRrMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /** Assemble the request payload shared by create + edit + test. */
  function buildPayload(): {
    valid: boolean
    error?: string
    payload?: Record<string, unknown>
  } {
    if (!name.trim()) return { valid: false, error: 'Name is required' }
    if (!sourceId) return { valid: false, error: 'Source is required' }
    if (!endpointUrl.trim()) return { valid: false, error: 'Endpoint URL is required' }
    try {
      new URL(endpointUrl)
    } catch {
      return { valid: false, error: 'Endpoint URL is not valid' }
    }
    if (!refIdPath.trim()) return { valid: false, error: 'Ref ID path is required' }

    // Nest the flat mappings back into { contact, deal }.
    const nested: WebhookFieldMappings = { contact: {}, deal: {} }
    for (const [k, v] of Object.entries(mappings)) {
      const trimmed = v.trim()
      if (!trimmed) continue
      const [bucket, ...rest] = k.split('.')
      const slot = rest.join('.')
      if (bucket === 'contact' && nested.contact) nested.contact[slot] = trimmed
      else if (bucket === 'deal' && nested.deal && createsDeal) nested.deal[slot] = trimmed
    }

    if (!nested.contact?.phone && !nested.contact?.email) {
      return { valid: false, error: 'Map at least a Contact Phone or Email path' }
    }

    let parsedBody: Record<string, unknown> | null = null
    if (httpMethod === 'POST' && bodyTemplate.trim()) {
      try {
        parsedBody = JSON.parse(bodyTemplate)
      } catch {
        return { valid: false, error: 'Request body must be valid JSON' }
      }
    }

    return {
      valid: true,
      payload: {
        name: name.trim(),
        source_id: sourceId,
        is_active: isActive,
        creates_deal: createsDeal,
        endpoint_url: endpointUrl.trim(),
        http_method: httpMethod,
        headers: headers.filter((h) => h.key.trim()),
        query_params: queryParams.filter((q) => q.key.trim()),
        body_template: parsedBody,
        items_path: itemsPath.trim() || null,
        ref_id_path: refIdPath.trim(),
        field_mappings: nested,
        poll_interval_minutes: pollInterval,
        round_robin_override: rrOverride,
        round_robin_member_ids: rrMembers,
      },
    }
  }

  async function handleSave() {
    const { valid, error, payload } = buildPayload()
    if (!valid) {
      toast.error(error!)
      return
    }
    setSaving(true)
    try {
      const url = isEdit
        ? `/api/integrations/fetch-sources/${fetchSource!.id}`
        : '/api/integrations/fetch-sources'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(body?.error ?? 'Failed to save fetch source')
        return
      }
      toast.success(isEdit ? 'Fetch source updated' : 'Fetch source created')
      onOpenChange(false)
      onSaved()
    } catch {
      toast.error('Network error saving fetch source')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Test runs against the SAVED config, so it is only available in edit mode.
   * Save first, then test from the list or detail. Here we save (if valid)
   * then immediately call the dry-run endpoint.
   */
  async function handleTest() {
    if (!isEdit || !fetchSource) {
      toast.error('Save the source first, then Test')
      return
    }
    const { valid, error, payload } = buildPayload()
    if (!valid) {
      toast.error(error!)
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      // Persist current edits so the test reflects what's on screen.
      const saveRes = await fetch(`/api/integrations/fetch-sources/${fetchSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!saveRes.ok) {
        const b = await saveRes.json().catch(() => ({}))
        toast.error(b?.error ?? 'Failed to save before test')
        return
      }
      const res = await fetch(`/api/integrations/fetch-sources/${fetchSource.id}/test`, {
        method: 'POST',
      })
      const body = (await res.json()) as PollSummary
      if (!res.ok) {
        toast.error((body as unknown as { error?: string })?.error ?? 'Test failed')
        return
      }
      setTestResult(body)
      onSaved()
    } catch {
      toast.error('Network error during test')
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Edit Fetch Source' : 'Create Fetch Source'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Poll a provider&rsquo;s API for new leads on a schedule. Configure the request, how to
            locate leads in the response, and how each lead maps to your CRM fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Basics ───────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Basics</p>
            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. HubSpot Leads"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">
                Source <span className="text-red-400">*</span>
              </Label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
              >
                <option value="">— select —</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="size-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-200">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createsDeal}
                  onChange={(e) => setCreatesDeal(e.target.checked)}
                  className="size-4 rounded border-slate-700 bg-slate-800 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-200">Create a deal per lead</span>
              </label>
            </div>
          </section>

          {/* ── Request ──────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Request</p>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="grid gap-2">
                <Label className="text-slate-300 text-xs">Method</Label>
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value as 'GET' | 'POST')}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-300 text-xs">
                  Endpoint URL <span className="text-red-400">*</span>
                </Label>
                <Input
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://api.provider.com/v1/leads"
                  className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Headers */}
            <KeyValueEditor
              label="Headers"
              hint="e.g. Authorization: Bearer <token>, X-API-Key: <key>"
              rows={headers.map((h) => ({ key: h.key, value: h.value }))}
              valuePlaceholder="value"
              onChange={(rows) => setHeaders(rows.map((r) => ({ key: r.key, value: r.value })))}
            />

            {/* Query params */}
            <KeyValueEditor
              label="Query parameters"
              hint="Values support placeholders: {{now}}, {{now-24h|iso}}, {{last_fetch|unix}}"
              rows={queryParams.map((q) => ({ key: q.key, value: q.value_template }))}
              valuePlaceholder="{{now-24h|iso}}"
              mono
              onChange={(rows) =>
                setQueryParams(rows.map((r) => ({ key: r.key, value_template: r.value })))
              }
            />

            {httpMethod === 'POST' && (
              <div className="grid gap-2">
                <Label className="text-slate-300 text-xs">Request body (JSON)</Label>
                <textarea
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  placeholder={'{\n  "since": "{{last_fetch|iso}}"\n}'}
                  rows={5}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-mono text-white outline-none focus:border-primary"
                />
                <p className="text-[11px] text-slate-500">
                  String values support the same <code>{'{{date}}'}</code> placeholders.
                </p>
              </div>
            )}
          </section>

          {/* ── Response parsing ─────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Response parsing
            </p>
            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">Items path</Label>
              <Input
                value={itemsPath}
                onChange={(e) => setItemsPath(e.target.value)}
                placeholder="data.leads  (leave blank if the response is itself an array)"
                className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300 text-xs">
                Ref ID path <span className="text-red-400">*</span>
              </Label>
              <Input
                value={refIdPath}
                onChange={(e) => setRefIdPath(e.target.value)}
                placeholder="$.id"
                className="bg-slate-800 border-slate-700 text-white font-mono text-xs"
              />
              <p className="text-[11px] text-slate-500">
                Unique id of each record — used to avoid re-importing the same lead.
              </p>
            </div>
          </section>

          {/* ── Field mapping ────────────────────────────────── */}
          <section className="space-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Field Mapping
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Map each CRM field to a dot-notation path within a single lead record. At least a
                phone or email is required.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400">Contact</p>
              {CONTACT_STANDARD_SLOTS.map((s) => (
                <MappingRow
                  key={`contact.${s.slot}`}
                  label={s.label}
                  defaultValue={s.defaultKey}
                  value={mappings[`contact.${s.slot}`] ?? ''}
                  onChange={(v) => setMapping(`contact.${s.slot}`, v)}
                />
              ))}
              {contactCustomFields.map((f) => (
                <MappingRow
                  key={`contact.cf:${f.id}`}
                  label={f.field_name}
                  defaultValue={defaultKeyForCustomField(f.field_name)}
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
                    defaultValue={s.defaultKey}
                    value={mappings[`deal.${s.slot}`] ?? ''}
                    onChange={(v) => setMapping(`deal.${s.slot}`, v)}
                  />
                ))}
                {dealCustomFields.map((f) => (
                  <MappingRow
                    key={`deal.cf:${f.id}`}
                    label={f.field_name}
                    defaultValue={defaultKeyForCustomField(f.field_name)}
                    value={mappings[`deal.cf:${f.id}`] ?? ''}
                    onChange={(v) => setMapping(`deal.cf:${f.id}`, v)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Schedule ─────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Schedule
            </p>
            <div className="grid gap-2 max-w-xs">
              <Label className="text-slate-300 text-xs">Poll every</Label>
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
              >
                {INTERVAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minute{m === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* ── Assignment ───────────────────────────────────── */}
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
                Override global round-robin for this source
              </span>
            </label>
            {rrOverride && (
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
                      <span
                        className={`size-3.5 shrink-0 rounded-sm border ${selected ? 'bg-primary border-primary' : 'border-slate-600'}`}
                      >
                        {selected && <Check className="size-3 text-primary-foreground" />}
                      </span>
                      <span className="truncate">{p.full_name || p.email}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Test result ──────────────────────────────────── */}
          {testResult && (
            <section className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Test result (no data saved)
              </p>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs space-y-2">
                <div className="flex flex-wrap gap-3 text-slate-300">
                  <span>
                    Status: <strong className={testResult.status === 'error' ? 'text-red-400' : 'text-emerald-400'}>{testResult.status}</strong>
                  </span>
                  <span>HTTP {testResult.http_status ?? '—'}</span>
                  <span>{testResult.items_fetched} items found</span>
                </div>
                {testResult.error_message && (
                  <p className="text-red-300">{testResult.error_message}</p>
                )}
                {testResult.preview && testResult.preview.length > 0 && (
                  <div className="space-y-1">
                    {testResult.preview.map((p, i) => (
                      <div key={i} className="rounded border border-slate-700/60 bg-slate-900/60 px-2 py-1">
                        <span className="text-slate-500">ref:</span>{' '}
                        <code className="text-slate-300">{p.ref_id ?? '∅'}</code>{' '}
                        <span className="text-slate-500">→</span>{' '}
                        <span className="text-slate-300">
                          {p.contact.name || p.contact.phone || p.contact.email || '(no contact data)'}
                        </span>
                        {p.skipped_reason && (
                          <span className="text-amber-400"> · {p.skipped_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isEdit && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || saving}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 mr-auto"
            >
              {testing ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Test
            </Button>
          )}
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
            {isEdit ? 'Save Changes' : 'Create Source'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Key/value rows (headers + query params) ─────────────────────
function KeyValueEditor({
  label,
  hint,
  rows,
  valuePlaceholder,
  mono,
  onChange,
}: {
  label: string
  hint?: string
  rows: { key: string; value: string }[]
  valuePlaceholder?: string
  mono?: boolean
  onChange: (rows: { key: string; value: string }[]) => void
}) {
  function update(i: number, patch: Partial<{ key: string; value: string }>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  return (
    <div className="grid gap-2">
      <Label className="text-slate-300 text-xs">{label}</Label>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <Input
            value={r.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder="key"
            className="bg-slate-900 border-slate-700 text-white text-xs h-8 font-mono"
          />
          <Input
            value={r.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder ?? 'value'}
            className={`bg-slate-900 border-slate-700 text-white text-xs h-8 ${mono ? 'font-mono' : ''}`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="flex items-center justify-center size-8 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:bg-red-500/15 hover:text-red-400 cursor-pointer"
            title="Remove"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { key: '', value: '' }])}
        className="flex items-center gap-1 self-start text-[11px] text-primary hover:text-primary/80 cursor-pointer"
      >
        <Plus className="size-3" /> Add {label.toLowerCase().replace(/s$/, '')}
      </button>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

// ── Mapping row (optional, with reset-to-default) ───────────────
function MappingRow({
  label,
  defaultValue,
  value,
  onChange,
}: {
  label: string
  defaultValue: string
  value: string
  onChange: (v: string) => void
}) {
  const isDefault = value === defaultValue
  return (
    <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center">
      <Label className="text-xs text-slate-300">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultValue}
        className="bg-slate-900 border-slate-700 text-white text-xs font-mono h-8"
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
