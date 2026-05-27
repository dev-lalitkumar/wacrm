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
// Every code path that returns also writes a `webhook_requests`
// row so admins can debug what's hitting their endpoint.
// ============================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const admin = supabaseAdmin()

  // ─── Read the body once. ─────────────────────────────────
  // Used to log a preview AND parse — we never re-read the stream.
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
    // No log row — the FK target doesn't exist, so we can't insert.
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
  const rate = await checkRateLimit(
    webhookId,
    webhook.rate_limit_per_minute,
    admin,
  )
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
    admin
      .from('custom_fields')
      .select('*')
      .eq('applies_to', 'contact'),
    admin
      .from('custom_fields')
      .select('*')
      .eq('applies_to', 'deal'),
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

  // Phone is the only contact field we require. We don't have a hard
  // DB constraint on which lookup key to use, but `phone` is what every
  // other code path matches on, so without it we'd duplicate forever.
  const phoneRaw = mapped.contact.standard.phone
  if (!phoneRaw || !String(phoneRaw).trim()) {
    await logRequest('bad_payload', { error_message: 'Mapped phone is empty' })
    return NextResponse.json(
      { error: 'Mapped contact.phone is empty' },
      { status: 400 },
    )
  }
  const normalizedPhone = normalizePhone(String(phoneRaw))

  // ─── 8. Find or merge-and-enrich contact ─────────────────
  // Search by fuzzy phone match (same helper used by the WhatsApp
  // webhook). Single-org dataset, so a full-table scan is fine.
  const { data: existing } = await admin.from('contacts').select('*')
  const existingMatch =
    (existing ?? []).find((c: { phone: string }) =>
      phonesMatch(c.phone, normalizedPhone),
    ) ?? null

  let contactId: string
  if (existingMatch) {
    // Merge & enrich: only fill blanks on standard fields; merge keys
    // into custom_data; set source_id only if previously NULL.
    const patch: Record<string, unknown> = {}
    if (!existingMatch.name && mapped.contact.standard.name) {
      patch.name = mapped.contact.standard.name
    }
    if (!existingMatch.email && mapped.contact.standard.email) {
      patch.email = mapped.contact.standard.email
    }
    if (!existingMatch.company && mapped.contact.standard.company) {
      patch.company = mapped.contact.standard.company
    }
    if (!existingMatch.source_id) {
      patch.source_id = webhook.source_id
    }
    const mergedCustom = {
      ...((existingMatch.custom_data ?? {}) as Record<string, unknown>),
      ...mapped.contact.custom_data,
    }
    if (Object.keys(mapped.contact.custom_data).length > 0) {
      patch.custom_data = mergedCustom
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
        return NextResponse.json(
          { error: 'Failed to update contact' },
          { status: 500 },
        )
      }
    }
    contactId = existingMatch.id as string
  } else {
    // New contact. Service-role bypasses the assigned_to trigger
    // (it would set NULL anyway since my_profile_id() returns NULL
    // outside a session), so set assigned_to explicitly via
    // round-robin. Falls back to NULL if no pool is configured.
    const assignedTo = await pickNextAssignee(webhookId, admin)

    const { data: newContact, error: insErr } = await admin
      .from('contacts')
      .insert({
        // Audit-only — there's no signed-in user for webhook inserts.
        // Use the webhook creator's user_id when known, else NULL.
        user_id: null,
        phone: normalizedPhone,
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
      .select('id')
      .single()

    if (insErr || !newContact) {
      console.error('[webhook ingest] contact insert failed:', insErr?.message)
      await logRequest('error', { error_message: 'Contact insert failed' })
      return NextResponse.json(
        { error: 'Failed to create contact' },
        { status: 500 },
      )
    }
    contactId = newContact.id as string
  }

  // ─── 9. Optionally create a deal ─────────────────────────
  let dealId: string | null = null
  if (webhook.creates_deal && webhook.pipeline_id && webhook.stage_id && mapped.deal) {
    // Rotate again for the deal — if the global pool is large enough,
    // the deal can land on a different rep than the contact. Cheap
    // and keeps the rotation balanced across both targets.
    const dealAssignedTo = await pickNextAssignee(webhookId, admin)

    const dealRow: Record<string, unknown> = {
      title:
        mapped.deal.standard.title ??
        `Lead from ${webhook.name}`, // sensible default when title isn't mapped
      value: mapped.deal.standard.value ?? 0,
      currency: 'USD',
      contact_id: contactId,
      pipeline_id: webhook.pipeline_id,
      stage_id: webhook.stage_id,
      assigned_to: dealAssignedTo,
      notes: mapped.deal.standard.notes ?? null,
      expected_close_date: mapped.deal.standard.expected_close_date ?? null,
      source_id: webhook.source_id,
      user_id: null,
      status: 'open',
      custom_data:
        Object.keys(mapped.deal.custom_data).length > 0
          ? mapped.deal.custom_data
          : {},
    }
    const { data: newDeal, error: dealErr } = await admin
      .from('deals')
      .insert(dealRow)
      .select('id')
      .single()
    if (dealErr || !newDeal) {
      console.error('[webhook ingest] deal insert failed:', dealErr?.message)
      // Don't fail the whole request — the contact already exists and
      // is the more valuable bit of data. Log so the admin can see.
      await logRequest('error', {
        created_contact_id: contactId,
        error_message: `Deal insert failed: ${dealErr?.message ?? 'unknown'}`,
      })
      return NextResponse.json(
        { contact_id: contactId, deal_error: dealErr?.message ?? 'unknown' },
        { status: 207 }, // multi-status: contact ok, deal failed
      )
    }
    dealId = newDeal.id as string
  }

  // ─── 10. Log success ────────────────────────────────────
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
