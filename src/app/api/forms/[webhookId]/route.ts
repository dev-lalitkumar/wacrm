import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import type { Webhook } from '@/types'
import { pickNextAssignee } from '@/lib/integrations/round-robin'
import { checkRateLimit } from '@/lib/integrations/rate-limit'
import { phonesMatch, normalizePhone } from '@/lib/whatsapp/phone-utils'
import { createContact } from '@/lib/contacts/service'
import { createDeal, deriveDealTitle } from '@/lib/deals/service'
import { dispatchNotification } from '@/lib/notifications/service'

/**
 * POST /api/forms/[webhookId]
 *
 * Public, secret-less lead intake for the hosted web form at /f/<id>.
 * Only works when the webhook has `public_form_enabled = true`. Reuses the
 * same dedup → round-robin → contact (+ optional deal) pipeline as the
 * authenticated webhook, but with a fixed field set and a honeypot instead
 * of a secret. Every submission is logged to webhook_requests.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const admin = supabaseAdmin()
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  let body: {
    name?: string; phone?: string; email?: string; company?: string;
    message?: string; website?: string // `website` = honeypot
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
  }

  // Honeypot: bots fill hidden fields. Pretend success, do nothing.
  if (body.website && body.website.trim() !== '') {
    return NextResponse.json({ status: 'ok' })
  }

  const { data: webhookRow } = await admin
    .from('webhooks').select('*').eq('id', webhookId).maybeSingle()
  const webhook = webhookRow as Webhook | null
  if (!webhook || !webhook.is_active || !webhook.public_form_enabled) {
    return NextResponse.json({ error: 'This form is not available' }, { status: 404 })
  }

  const logRequest = async (status: string, extra: Record<string, unknown> = {}) => {
    try {
      await admin.from('webhook_requests').insert({
        webhook_id: webhookId, ip_address: ipAddress, status,
        payload_preview: JSON.stringify(body).slice(0, 1024), ...extra,
      })
    } catch (err) { console.error('[public form] log failed:', err) }
  }

  // Rate limit (reuse the webhook's per-minute limit).
  const rate = await checkRateLimit(webhookId, webhook.rate_limit_per_minute, admin)
  if (!rate.allowed) {
    await logRequest('rate_limited')
    return NextResponse.json({ error: 'Too many submissions — try again shortly.' }, { status: 429 })
  }

  const normalizedPhone = body.phone?.trim() ? normalizePhone(String(body.phone)) : null
  const normalizedEmail = body.email?.trim() ? String(body.email).trim().toLowerCase() : null
  if (!normalizedPhone && !normalizedEmail) {
    await logRequest('bad_payload', { error_message: 'Missing phone and email' })
    return NextResponse.json({ error: 'Please provide a phone or email.' }, { status: 400 })
  }

  // Dedup: fuzzy phone, then exact email (same strategy as the webhook).
  const { data: existing } = await admin.from('contacts').select('*')
  const allContacts = (existing ?? []) as Array<Record<string, unknown>>
  const match =
    (normalizedPhone ? allContacts.find((c) => c.phone && phonesMatch(String(c.phone), normalizedPhone)) : null) ??
    (normalizedEmail ? allContacts.find((c) => c.email && String(c.email).trim().toLowerCase() === normalizedEmail) : null) ??
    null

  let contactId: string
  let assignee: string | null = null
  let isNewContact = false

  if (match) {
    contactId = match.id as string
    assignee = (match.assigned_to as string | null) ?? null
    // Enrich blanks only (never overwrite); source_id is immutable.
    const patch: Record<string, unknown> = {}
    if (!match.name && body.name?.trim()) patch.name = body.name.trim()
    if (!match.email && normalizedEmail) patch.email = normalizedEmail
    if (!match.company && body.company?.trim()) patch.company = body.company.trim()
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await admin.from('contacts').update(patch).eq('id', contactId)
    }
  } else {
    assignee = await pickNextAssignee(webhookId, admin)
    try {
      const result = await createContact(admin, {
        phone: normalizedPhone ?? '',
        name: body.name?.trim() || null,
        email: normalizedEmail,
        company: body.company?.trim() || null,
        source_id: webhook.source_id,
        assigned_to: assignee,
        custom_data: {},
      })
      contactId = result.id
      isNewContact = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      await logRequest('error', { error_message: `Contact insert failed: ${msg}` })
      return NextResponse.json({ error: 'Could not submit. Please try again.' }, { status: 500 })
    }
    if (assignee) {
      dispatchNotification({
        type: 'contact.assigned', contactId, assigneeProfileId: assignee, assignerProfileId: null,
      }).catch((e) => console.error('[public form] notify failed:', e))
    }
  }

  // Optional deal in the webhook's configured pipeline/stage.
  let dealId: string | null = null
  if (webhook.creates_deal && webhook.pipeline_id && webhook.stage_id) {
    const dealAssignee = assignee ?? (await pickNextAssignee(webhookId, admin))
    try {
      const result = await createDeal(admin, {
        title: deriveDealTitle(body.name?.trim() || null, normalizedPhone, `Lead from ${webhook.name}`),
        pipeline_id: webhook.pipeline_id,
        stage_id: webhook.stage_id,
        source_id: webhook.source_id,
        contact_id: contactId,
        value: 0,
        expected_close_date: null,
        notes: body.message?.trim() || null,
        assigned_to: dealAssignee,
        custom_data: {},
      })
      dealId = result.id
      if (dealAssignee) {
        dispatchNotification({ type: 'deal.created', dealId, assigneeProfileId: dealAssignee })
          .catch((e) => console.error('[public form] deal notify failed:', e))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      await logRequest('error', { created_contact_id: contactId, error_message: `Deal insert failed: ${msg}` })
      // Contact still captured — treat as success for the visitor.
    }
  }

  await logRequest('ok', { created_contact_id: contactId, created_deal_id: dealId })
  return NextResponse.json({ status: 'ok', isNewContact })
}
