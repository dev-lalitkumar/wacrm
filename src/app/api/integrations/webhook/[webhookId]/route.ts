import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import type {
  CustomField,
  Webhook,
  WebhookFieldMappings,
  WebhookRequestStatus,
} from '@/types'
import { decryptSecret, secretsMatch } from '@/lib/integrations/secret'
import { applyMapping, type MappedPayload } from '@/lib/integrations/field-mapping'
import { pickNextAssignee } from '@/lib/integrations/round-robin'
import { checkRateLimit } from '@/lib/integrations/rate-limit'
import { phonesMatch, normalizePhone } from '@/lib/whatsapp/phone-utils'
import { createContact } from '@/lib/contacts/service'
import { createDeal, deriveDealTitle } from '@/lib/deals/service'

const PAYLOAD_PREVIEW_BYTES = 1024

// ============================================================
// POST /api/integrations/webhook/[webhookId]
//
// Public lead-ingestion endpoint.
//
// Auth:    X-Webhook-Secret header (constant-time compared)
// Body:    arbitrary JSON; mapping per `webhooks.field_mappings`
// Effects: create or merge a contact; optionally create a deal in
//          the webhook's configured pipeline/stage; round-robin
//          assignment; log every request to `webhook_requests`.
//
// Assignment strategy:
//   - New contact + new deal  → single round-robin pick, shared for both.
//   - Existing contact + new deal → inherit contact's assigned_to (skip RR);
//     fall back to RR only when the contact has no assignee.
//
// Duplicate detection:
//   1. Fuzzy phone match (last-8-digit normalisation via phonesMatch())
//   2. Exact email match as fallback when phone yields no match
//
// Partial payloads:
//   Title derived from contact name → contact phone → webhook name.
//   expected_close_date left NULL — rep fills in manually.
//
// Every code path writes a `webhook_requests` row for admin auditability.
// ============================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const admin = supabaseAdmin()

  // ─── Read the body once ──────────────────────────────────
  const rawBody = await request.text()
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const payloadPreview = rawBody.slice(0, PAYLOAD_PREVIEW_BYTES)

  async function logRequest(
    status: WebhookRequestStatus,
    extra: {
      error_message?: string
      created_contact_id?: string | null
      created_deal_id?: string | null
    } = {},
  ): Promise<void> {
    try {
      await admin.from('webhook_requests').insert({
        webhook_id: webhookId,
        ip_address: ipAddress,
        status,
        error_message: extra.error_message ?? null,
        payload_preview: payloadPreview,
        created_contact_id: extra.created_contact_id ?? null,
        created_deal_id: extra.created_deal_id ?? null,
      })
    } catch (err) {
      console.error('[webhook ingest] failed to log request:', err)
    }
  }

  // ─── 1. Resolve webhook ──────────────────────────────────
  const { data: webhookRow, error: whErr } = await admin
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .maybeSingle()

  if (whErr || !webhookRow) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }
  const webhook = webhookRow as Webhook

  // ─── 2. Is it active? ────────────────────────────────────
  if (!webhook.is_active) {
    await logRequest('disabled')
    return NextResponse.json({ error: 'Webhook is disabled' }, { status: 403 })
  }

  // ─── 3. Secret check ─────────────────────────────────────
  const presented = request.headers.get('x-webhook-secret') ?? ''
  let storedRaw: string
  try {
    storedRaw = decryptSecret(webhook.secret_encrypted)
  } catch (err) {
    console.error('[webhook ingest] secret decrypt failed:', err)
    await logRequest('error', { error_message: 'Secret decrypt failed' })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
  if (!presented || !secretsMatch(presented, storedRaw)) {
    await logRequest('invalid_secret')
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  // ─── 4. Rate limit ───────────────────────────────────────
  const rate = await checkRateLimit(webhookId, webhook.rate_limit_per_minute, admin)
  if (!rate.allowed) {
    await logRequest('rate_limited', {
      error_message: `${rate.count} requests in the last minute (limit ${webhook.rate_limit_per_minute})`,
    })
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  // ─── 5. Parse payload ────────────────────────────────────
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    await logRequest('bad_payload', { error_message: 'Invalid JSON' })
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ─── 6. Load custom fields for mapping coercion ─────────
  const [cCustomRes, dCustomRes] = await Promise.all([
    admin.from('custom_fields').select('*').eq('applies_to', 'contact'),
    admin.from('custom_fields').select('*').eq('applies_to', 'deal'),
  ])
  const contactCustomFields = (cCustomRes.data ?? []) as CustomField[]
  const dealCustomFields = (dCustomRes.data ?? []) as CustomField[]

  // ─── 7. Apply mappings ───────────────────────────────────
  const mapped: MappedPayload = applyMapping(
    payload,
    webhook.field_mappings as WebhookFieldMappings,
    contactCustomFields,
    dealCustomFields,
    webhook.creates_deal,
  )

  // Normalise the two dedup identifiers. At least one must be present.
  const phoneRaw = mapped.contact.standard.phone
  const normalizedPhone = phoneRaw?.trim()
    ? normalizePhone(String(phoneRaw))
    : null

  const emailRaw = mapped.contact.standard.email
  const normalizedEmail = emailRaw?.trim()
    ? String(emailRaw).trim().toLowerCase()
    : null

  if (!normalizedPhone && !normalizedEmail) {
    await logRequest('bad_payload', {
      error_message: 'Payload must include at least phone or email',
    })
    return NextResponse.json(
      { error: 'Payload must include at least phone or email' },
      { status: 400 },
    )
  }

  // ─── 8. Find or merge-and-enrich contact ─────────────────
  // Load all contacts for fuzzy matching (single-org dataset).
  const { data: existing } = await admin.from('contacts').select('*')
  const allContacts = (existing ?? []) as Array<Record<string, unknown>>

  // Priority: fuzzy phone match → exact email match
  const existingMatch: Record<string, unknown> | null =
    (normalizedPhone
      ? allContacts.find((c) =>
          c.phone ? phonesMatch(String(c.phone), normalizedPhone) : false,
        )
      : null) ??
    (normalizedEmail
      ? allContacts.find(
          (c) => c.email && String(c.email).trim().toLowerCase() === normalizedEmail,
        )
      : null) ??
    null

  // Track which profile the contact is assigned to — used to give the
  // linked deal the same assignee without a second round-robin rotation.
  let resolvedContactAssignedTo: string | null = null
  let contactId: string

  if (existingMatch) {
    // ── Merge & enrich: fill blanks only; never overwrite ───────────
    // source_id is immutable (DB trigger 017) — do not include it in patch.
    const patch: Record<string, unknown> = {}
    if (!existingMatch.name && mapped.contact.standard.name) {
      patch.name = mapped.contact.standard.name
    }
    if (!existingMatch.phone && normalizedPhone) {
      patch.phone = normalizedPhone
    }
    if (!existingMatch.email && mapped.contact.standard.email) {
      patch.email = mapped.contact.standard.email
    }
    if (!existingMatch.company && mapped.contact.standard.company) {
      patch.company = mapped.contact.standard.company
    }
    if (Object.keys(mapped.contact.custom_data).length > 0) {
      patch.custom_data = {
        ...((existingMatch.custom_data ?? {}) as Record<string, unknown>),
        ...mapped.contact.custom_data,
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      const { error: updErr } = await admin
        .from('contacts')
        .update(patch)
        .eq('id', existingMatch.id)
      if (updErr) {
        console.error('[webhook ingest] contact update failed:', updErr.message)
        await logRequest('error', { error_message: 'Contact update failed' })
        return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
      }
    }
    contactId = existingMatch.id as string
    // Inherit the existing contact's assignee for any new deal
    resolvedContactAssignedTo = (existingMatch.assigned_to as string | null) ?? null
  } else {
    // ── New contact — one round-robin pick, shared with the deal ─────
    const assignedTo = await pickNextAssignee(webhookId, admin)
    resolvedContactAssignedTo = assignedTo

    try {
      const result = await createContact(admin, {
        phone: normalizedPhone ?? '',
        name: mapped.contact.standard.name ?? null,
        email: mapped.contact.standard.email ?? null,
        company: mapped.contact.standard.company ?? null,
        source_id: webhook.source_id,
        assigned_to: assignedTo,
        custom_data:
          Object.keys(mapped.contact.custom_data).length > 0
            ? mapped.contact.custom_data
            : {},
      })
      contactId = result.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[webhook ingest] contact insert failed:', msg)
      await logRequest('error', { error_message: 'Contact insert failed' })
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }
  }

  // ─── 9. Optionally create a deal ─────────────────────────
  let dealId: string | null = null
  if (webhook.creates_deal && webhook.pipeline_id && webhook.stage_id && mapped.deal) {
    // ── Deal inherits the contact's assignee ────────────────────────
    // • Existing contact → resolvedContactAssignedTo is their current owner.
    // • New contact      → resolvedContactAssignedTo is the RR pick from step 8.
    // Fall back to a fresh RR rotation only when the contact has no assignee.
    const dealAssignedTo =
      resolvedContactAssignedTo ?? (await pickNextAssignee(webhookId, admin))

    const dealTitle = mapped.deal.standard.title?.trim() ||
      deriveDealTitle(
        mapped.contact.standard.name,
        normalizedPhone,
        `Lead from ${webhook.name}`,
      )

    try {
      const result = await createDeal(admin, {
        title: dealTitle,
        pipeline_id: webhook.pipeline_id,
        stage_id: webhook.stage_id,
        source_id: webhook.source_id,
        contact_id: contactId,
        value: mapped.deal.standard.value ?? 0,
        expected_close_date: mapped.deal.standard.expected_close_date ?? null,
        notes: mapped.deal.standard.notes ?? null,
        assigned_to: dealAssignedTo,
        custom_data:
          Object.keys(mapped.deal.custom_data).length > 0
            ? mapped.deal.custom_data
            : {},
      })
      dealId = result.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[webhook ingest] deal insert failed:', msg)
      // Don't fail the whole request — the contact already exists.
      await logRequest('error', {
        created_contact_id: contactId,
        error_message: `Deal insert failed: ${msg}`,
      })
      return NextResponse.json(
        { contact_id: contactId, deal_error: msg },
        { status: 207 }, // multi-status: contact ok, deal failed
      )
    }
  }

  // ─── 10. Log success ─────────────────────────────────────
  await logRequest('ok', {
    created_contact_id: contactId,
    created_deal_id: dealId,
  })

  return NextResponse.json({
    status: 'ok',
    contact_id: contactId,
    deal_id: dealId,
  })
}
