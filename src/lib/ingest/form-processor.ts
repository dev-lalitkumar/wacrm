import type { SupabaseClient } from '@supabase/supabase-js'
import type { Webhook } from '@/types'
import { pickNextAssignee } from '@/lib/integrations/round-robin'
import { phonesMatch, normalizePhone } from '@/lib/whatsapp/phone-utils'
import { createContact } from '@/lib/contacts/service'
import { createDeal, deriveDealTitle } from '@/lib/deals/service'
import { dispatchNotification } from '@/lib/notifications/service'
import type { InboundEvent, InboundEventResult } from './types'

const PAYLOAD_PREVIEW_BYTES = 1024

export interface FormProcessOutcome {
  status: 'success' | 'error' | 'skipped'
  errorMessage?: string
  result: InboundEventResult
}

async function logFormRequest(
  admin: SupabaseClient,
  webhookId: string,
  inboundEventId: string,
  ipAddress: string | null,
  rawBody: string,
  status: string,
  extra: Record<string, unknown> = {},
) {
  try {
    await admin.from('webhook_requests').insert({
      webhook_id: webhookId,
      inbound_event_id: inboundEventId,
      ip_address: ipAddress,
      status,
      payload_preview: rawBody.slice(0, PAYLOAD_PREVIEW_BYTES),
      ...extra,
    })
  } catch (err) {
    console.error('[ingest/form] webhook_requests log failed:', err)
  }
}

export async function processPublicFormEvent(
  admin: SupabaseClient,
  event: InboundEvent,
): Promise<FormProcessOutcome> {
  const webhookId = event.source_ref
  if (!webhookId) {
    return { status: 'error', errorMessage: 'Missing webhook id', result: {} }
  }

  let body: {
    name?: string
    phone?: string
    email?: string
    company?: string
    message?: string
    website?: string
  }
  try {
    body = JSON.parse(event.raw_body)
  } catch {
    return { status: 'error', errorMessage: 'Invalid JSON', result: {} }
  }

  const { data: webhookRow } = await admin
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .maybeSingle()
  const webhook = webhookRow as Webhook | null
  if (!webhook || !webhook.is_active || !webhook.public_form_enabled) {
    return { status: 'error', errorMessage: 'Form not available', result: {} }
  }

  const normalizedPhone = body.phone?.trim() ? normalizePhone(String(body.phone)) : null
  const normalizedEmail = body.email?.trim() ? String(body.email).trim().toLowerCase() : null

  if (!normalizedPhone && !normalizedEmail) {
    await logFormRequest(admin, webhookId, event.id, event.ip_address, event.raw_body, 'bad_payload', {
      error_message: 'Missing phone and email',
    })
    return {
      status: 'skipped',
      errorMessage: 'Missing phone and email',
      result: {},
    }
  }

  const { data: existing } = await admin.from('contacts').select('*')
  const allContacts = (existing ?? []) as Array<Record<string, unknown>>
  const match =
    (normalizedPhone
      ? allContacts.find((c) => c.phone && phonesMatch(String(c.phone), normalizedPhone))
      : null) ??
    (normalizedEmail
      ? allContacts.find(
          (c) => c.email && String(c.email).trim().toLowerCase() === normalizedEmail,
        )
      : null) ??
    null

  let contactId: string
  let assignee: string | null = null
  let isNewContact = false

  if (match) {
    contactId = match.id as string
    assignee = (match.assigned_to as string | null) ?? null
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
      await logFormRequest(admin, webhookId, event.id, event.ip_address, event.raw_body, 'error', {
        error_message: `Contact insert failed: ${msg}`,
      })
      return { status: 'error', errorMessage: `Contact insert failed: ${msg}`, result: {} }
    }
    if (assignee) {
      dispatchNotification({
        type: 'contact.assigned',
        contactId,
        assigneeProfileId: assignee,
        assignerProfileId: null,
      }).catch((e) => console.error('[ingest/form] notify failed:', e))
    }
  }

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
        dispatchNotification({
          type: 'deal.created',
          dealId,
          assigneeProfileId: dealAssignee,
        }).catch((e) => console.error('[ingest/form] deal notify failed:', e))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      await logFormRequest(admin, webhookId, event.id, event.ip_address, event.raw_body, 'error', {
        created_contact_id: contactId,
        error_message: `Deal insert failed: ${msg}`,
      })
      return {
        status: 'error',
        errorMessage: `Deal insert failed: ${msg}`,
        result: { contact_id: contactId, is_new_contact: isNewContact },
      }
    }
  }

  await logFormRequest(admin, webhookId, event.id, event.ip_address, event.raw_body, 'ok', {
    created_contact_id: contactId,
    created_deal_id: dealId,
  })

  return {
    status: 'success',
    result: {
      contact_id: contactId,
      deal_id: dealId,
      is_new_contact: isNewContact,
      deduplicated: !isNewContact,
    },
  }
}
