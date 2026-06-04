/**
 * Lead-fetch engine — the pull-based counterpart of the webhook ingestion
 * route. Given a configured `lead_fetch_sources` row it:
 *
 *   1. renders the request (decrypt headers, expand {{date}} placeholders in
 *      query params + body),
 *   2. calls the provider endpoint,
 *   3. locates the lead array in the response (`items_path`),
 *   4. for each item: dedups on the configured `ref_id_path` (ref-id-only —
 *      no phone/email merge), maps fields, then creates a contact and an
 *      optional deal,
 *   5. records a `lead_fetch_runs` audit row and advances the source's
 *      scheduling columns.
 *
 * Dedup is enforced by the UNIQUE(fetch_source_id, ref_id) constraint on
 * `lead_fetch_seen_refs`: we insert-with-ignore-duplicates BEFORE creating,
 * which both prevents re-imports across polls and makes two overlapping runs
 * safe (only one wins the claim).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CustomField,
  FetchHeader,
  LeadFetchRunStatus,
  LeadFetchSource,
  WebhookFieldMappings,
} from '@/types'
import { decrypt } from '@/lib/whatsapp/encryption'
import { applyMapping, resolvePath, type MappedPayload } from '@/lib/integrations/field-mapping'
import { renderTemplate, renderDeep, type TemplateContext } from '@/lib/integrations/template'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { createContact } from '@/lib/contacts/service'
import { createDeal, deriveDealTitle } from '@/lib/deals/service'

const MAX_ITEMS_PER_RUN = 500
const FETCH_TIMEOUT_MS = 20_000
const RESPONSE_PREVIEW_BYTES = 1024

export interface PollPreviewItem {
  ref_id: string | null
  contact: MappedPayload['contact']['standard']
  deal: NonNullable<MappedPayload['deal']>['standard'] | null
  /** Set when this item would be skipped (and why) rather than imported. */
  skipped_reason?: string
}

export interface PollSummary {
  status: LeadFetchRunStatus
  http_status: number | null
  resolved_url: string
  items_fetched: number
  items_created: number
  items_skipped: number
  items_failed: number
  error_message: string | null
  response_preview: string | null
  /** Populated only on a dry run (the Test action). */
  preview?: PollPreviewItem[]
}

interface PollOptions {
  /** When true, calls the endpoint but writes nothing and returns a preview. */
  dryRun?: boolean
  /** Cap previewed/processed items (dry run uses a small default). */
  maxItems?: number
}

/**
 * Decrypt + parse the stored headers blob into a record. Returns {} when
 * there are no headers. Throws only on a genuinely malformed ciphertext.
 */
function decryptHeaders(headersEncrypted: string | null | undefined): FetchHeader[] {
  if (!headersEncrypted) return []
  const raw = decrypt(headersEncrypted)
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? (parsed as FetchHeader[]) : []
}

/** Build the fully-rendered request for a source. */
function buildRequest(
  source: LeadFetchSource,
  ctx: TemplateContext,
): { url: string; init: RequestInit } {
  // Query params → rendered, appended to the endpoint (preserving any
  // existing query string the admin baked into endpoint_url).
  const url = new URL(source.endpoint_url)
  for (const p of source.query_params ?? []) {
    if (!p.key?.trim()) continue
    url.searchParams.set(p.key, renderTemplate(p.value_template ?? '', ctx))
  }

  const headers: Record<string, string> = {}
  for (const h of decryptHeaders(source.headers_encrypted)) {
    if (!h.key?.trim()) continue
    headers[h.key] = renderTemplate(h.value ?? '', ctx)
  }

  const init: RequestInit = { method: source.http_method, headers }
  if (source.http_method === 'POST' && source.body_template) {
    const body = renderDeep(source.body_template, ctx)
    init.body = JSON.stringify(body)
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
  }

  return { url: url.toString(), init }
}

/** Locate the lead array inside a parsed response body. */
export function locateItems(body: unknown, itemsPath: string | null | undefined): unknown[] | null {
  const located = itemsPath?.trim() ? resolvePath(body, itemsPath) : body
  return Array.isArray(located) ? located : null
}

/**
 * Run one poll for a source.
 *
 * On a real run this mutates the DB (contacts/deals/seen_refs/runs) and
 * advances the source's scheduling columns. On a dry run it only calls the
 * endpoint and returns a mapping preview.
 */
export async function pollSource(
  admin: SupabaseClient,
  source: LeadFetchSource,
  opts: PollOptions = {},
): Promise<PollSummary> {
  const dryRun = opts.dryRun ?? false
  const startedAt = new Date()
  const ctx: TemplateContext = {
    now: startedAt,
    lastFetch: source.last_cursor ? new Date(source.last_cursor) : null,
    intervalMinutes: source.poll_interval_minutes,
  }

  const summary: PollSummary = {
    status: 'ok',
    http_status: null,
    resolved_url: source.endpoint_url,
    items_fetched: 0,
    items_created: 0,
    items_skipped: 0,
    items_failed: 0,
    error_message: null,
    response_preview: null,
    ...(dryRun ? { preview: [] as PollPreviewItem[] } : {}),
  }

  try {
    const { url, init } = buildRequest(source, ctx)
    summary.resolved_url = url

    // ─── Call the provider ─────────────────────────────────
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let res: Response
    let text: string
    try {
      res = await fetch(url, { ...init, signal: controller.signal })
      text = await res.text()
    } finally {
      clearTimeout(timer)
    }
    summary.http_status = res.status
    summary.response_preview = text.slice(0, RESPONSE_PREVIEW_BYTES)

    if (!res.ok) {
      summary.status = 'error'
      summary.error_message = `Provider returned ${res.status}`
      return await finalize(admin, source, summary, startedAt, ctx, dryRun)
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      summary.status = 'error'
      summary.error_message = 'Response was not valid JSON'
      return await finalize(admin, source, summary, startedAt, ctx, dryRun)
    }

    const items = locateItems(parsed, source.items_path)
    if (!items) {
      summary.status = 'error'
      summary.error_message = source.items_path?.trim()
        ? `No array found at items_path "${source.items_path}"`
        : 'Response body is not an array (set an items_path)'
      return await finalize(admin, source, summary, startedAt, ctx, dryRun)
    }

    const cap = dryRun ? (opts.maxItems ?? 5) : Math.min(items.length, MAX_ITEMS_PER_RUN)
    const slice = items.slice(0, cap)
    summary.items_fetched = items.length

    // Load custom fields once for coercion (mirrors the webhook route).
    const [cRes, dRes] = await Promise.all([
      admin.from('custom_fields').select('*').eq('applies_to', 'contact'),
      admin.from('custom_fields').select('*').eq('applies_to', 'deal'),
    ])
    const contactCF = (cRes.data ?? []) as CustomField[]
    const dealCF = (dRes.data ?? []) as CustomField[]

    for (const item of slice) {
      await processItem(admin, source, item, contactCF, dealCF, summary, dryRun)
    }

    if (summary.status !== 'error') {
      summary.status = summary.items_failed > 0 ? 'partial' : 'ok'
    }
    return await finalize(admin, source, summary, startedAt, ctx, dryRun)
  } catch (err) {
    summary.status = 'error'
    summary.error_message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Request timed out after ${FETCH_TIMEOUT_MS}ms`
          : err.message
        : 'Unknown fetch error'
    return await finalize(admin, source, summary, startedAt, ctx, dryRun)
  }
}

/** Map + (optionally) import a single provider record. */
async function processItem(
  admin: SupabaseClient,
  source: LeadFetchSource,
  item: unknown,
  contactCF: CustomField[],
  dealCF: CustomField[],
  summary: PollSummary,
  dryRun: boolean,
): Promise<void> {
  const refRaw = resolvePath(item, source.ref_id_path)
  const refId =
    refRaw == null || refRaw === '' ? null : String(refRaw)

  const mapped = applyMapping(
    item,
    source.field_mappings as WebhookFieldMappings,
    contactCF,
    dealCF,
    source.creates_deal,
  )

  const phoneRaw = mapped.contact.standard.phone
  const normalizedPhone = phoneRaw?.trim() ? normalizePhone(String(phoneRaw)) : null
  const emailRaw = mapped.contact.standard.email
  const normalizedEmail = emailRaw?.trim() ? String(emailRaw).trim().toLowerCase() : null

  // ─── Dry run: report what would happen, write nothing ────
  if (dryRun) {
    let reason: string | undefined
    if (!refId) reason = 'No ref id at ref_id_path — would be skipped'
    else if (!normalizedPhone && !normalizedEmail) reason = 'No phone or email — would be skipped'
    summary.preview!.push({
      ref_id: refId,
      contact: mapped.contact.standard,
      deal: mapped.deal?.standard ?? null,
      ...(reason ? { skipped_reason: reason } : {}),
    })
    return
  }

  if (!refId) {
    summary.items_failed++
    return
  }

  // ─── Atomic claim of this ref (dedup + overlap guard) ────
  const { data: claimed } = await admin
    .from('lead_fetch_seen_refs')
    .upsert(
      { fetch_source_id: source.id, ref_id: refId },
      { onConflict: 'fetch_source_id,ref_id', ignoreDuplicates: true },
    )
    .select('id')
  const claimedId = (claimed?.[0]?.id as string | undefined) ?? null
  if (!claimedId) {
    // Already imported in a previous (or concurrent) poll.
    summary.items_skipped++
    return
  }

  // Release the claim so a corrected record can be retried on a later poll.
  const releaseClaim = async () => {
    await admin.from('lead_fetch_seen_refs').delete().eq('id', claimedId)
  }

  if (!normalizedPhone && !normalizedEmail) {
    await releaseClaim()
    summary.items_failed++
    return
  }

  try {
    // Ref-id-only dedup: always create a fresh contact (no phone/email merge).
    const assignee = await pickFetchAssignee(source.id, admin)
    const contact = await createContact(admin, {
      phone: normalizedPhone ?? '',
      name: mapped.contact.standard.name ?? null,
      email: mapped.contact.standard.email ?? null,
      company: mapped.contact.standard.company ?? null,
      source_id: source.source_id,
      assigned_to: assignee,
      custom_data:
        Object.keys(mapped.contact.custom_data).length > 0 ? mapped.contact.custom_data : {},
    })

    let dealId: string | null = null
    if (source.creates_deal && source.pipeline_id && source.stage_id && mapped.deal) {
      const title =
        mapped.deal.standard.title?.trim() ||
        deriveDealTitle(
          mapped.contact.standard.name,
          normalizedPhone,
          `Lead from ${source.name}`,
        )
      const deal = await createDeal(admin, {
        title,
        pipeline_id: source.pipeline_id,
        stage_id: source.stage_id,
        source_id: source.source_id,
        contact_id: contact.id,
        value: mapped.deal.standard.value ?? 0,
        expected_close_date: mapped.deal.standard.expected_close_date ?? null,
        notes: mapped.deal.standard.notes ?? null,
        assigned_to: assignee,
        custom_data:
          Object.keys(mapped.deal.custom_data).length > 0 ? mapped.deal.custom_data : {},
      })
      dealId = deal.id
    }

    await admin
      .from('lead_fetch_seen_refs')
      .update({ created_contact_id: contact.id, created_deal_id: dealId })
      .eq('id', claimedId)
    summary.items_created++
  } catch (err) {
    console.error('[fetch-engine] item import failed:', err instanceof Error ? err.message : err)
    await releaseClaim()
    summary.items_failed++
  }
}

/**
 * Per-source round-robin pick. Delegates to the SECURITY DEFINER SQL
 * function `pick_next_assignee_fetch` (migration 042). Never throws — a RR
 * failure must not break ingestion; the contact is just left unassigned.
 */
async function pickFetchAssignee(
  fetchId: string,
  admin: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await admin.rpc('pick_next_assignee_fetch', {
    p_fetch_id: fetchId,
  })
  if (error) {
    console.error('[fetch-engine] pick_next_assignee_fetch failed:', error.message)
    return null
  }
  return (data as string | null) ?? null
}

/**
 * Write the run log + advance the source's scheduling columns. On a dry run
 * this is a no-op that just returns the summary.
 */
async function finalize(
  admin: SupabaseClient,
  source: LeadFetchSource,
  summary: PollSummary,
  startedAt: Date,
  ctx: TemplateContext,
  dryRun: boolean,
): Promise<PollSummary> {
  if (dryRun) return summary

  const finishedAt = new Date()
  try {
    await admin.from('lead_fetch_runs').insert({
      fetch_source_id: source.id,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      status: summary.status,
      http_status: summary.http_status,
      resolved_url: summary.resolved_url,
      items_fetched: summary.items_fetched,
      items_created: summary.items_created,
      items_skipped: summary.items_skipped,
      items_failed: summary.items_failed,
      error_message: summary.error_message,
      response_preview: summary.response_preview,
    })
  } catch (err) {
    console.error('[fetch-engine] failed to write run log:', err)
  }

  const nextPollAt = new Date(
    finishedAt.getTime() + source.poll_interval_minutes * 60_000,
  )
  const patch: Record<string, unknown> = {
    last_polled_at: finishedAt.toISOString(),
    last_status: summary.status,
    last_error: summary.error_message,
    next_poll_at: nextPollAt.toISOString(),
    updated_at: finishedAt.toISOString(),
  }
  // Only advance the cursor on a successful fetch so a transient failure
  // doesn't skip a time window.
  if (summary.status !== 'error') {
    patch.last_cursor = ctx.now.toISOString()
  }
  await admin.from('lead_fetch_sources').update(patch).eq('id', source.id)

  return summary
}
