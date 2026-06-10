import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomField, Webhook, WebhookFieldMappings, WebhookRequestStatus } from '@/types'
import { decryptSecret, secretsMatch } from '@/lib/integrations/secret'
import { applyMapping, type MappedPayload } from '@/lib/integrations/field-mapping'
import { pickNextAssignee } from '@/lib/integrations/round-robin'
import { phonesMatch, normalizePhone } from '@/lib/whatsapp/phone-utils'
import { createContact } from '@/lib/contacts/service'
import { createDeal, deriveDealTitle } from '@/lib/deals/service'
import type { InboundEvent, InboundEventResult } from './types'

const PAYLOAD_PREVIEW_BYTES = 1024

export interface IntegrationProcessOutcome {
  status: 'success' | 'error' | 'skipped'
  errorMessage?: string
  result: InboundEventResult
  webhookRequestStatus?: WebhookRequestStatus
}

async function logWebhookRequest(
  admin: SupabaseClient,
  webhookId: string,
  inboundEventId: string,
  ipAddress: string | null,
  rawBody: string,
  status: WebhookRequestStatus,
  extra: {
    error_message?: string
    created_contact_id?: string | null
    created_deal_id?: string | null
  } = {},
) {
  try {
    await admin.from('webhook_requests').insert({
      webhook_id: webhookId,
      inbound_event_id: inboundEventId,
      ip_address: ipAddress,
      status,
      error_message: extra.error_message ?? null,
      payload_preview: rawBody.slice(0, PAYLOAD_PREVIEW_BYTES),
      created_contact_id: extra.created_contact_id ?? null,
      created_deal_id: extra.created_deal_id ?? null,
    })
  } catch (err) {
    console.error('[ingest/integration] webhook_requests log failed:', err)
  }
}

export async function processIntegrationWebhookEvent(
  admin: SupabaseClient,
  event: InboundEvent,
): Promise<IntegrationProcessOutcome> {
  const webhookId = event.source_ref
  if (!webhookId) {
    return { status: 'error', errorMessage: 'Missing webhook id', result: {} }
  }

  const ipAddress = event.ip_address
  const rawBody = event.raw_body

  const { data: webhookRow, error: whErr } = await admin
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .maybeSingle()

  if (whErr || !webhookRow) {
    return { status: 'error', errorMessage: 'Webhook not found', result: {} }
  }
  const webhook = webhookRow as Webhook

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'bad_payload', {
      error_message: 'Invalid JSON',
    })
    return {
      status: 'skipped',
      errorMessage: 'Invalid JSON body',
      result: {},
      webhookRequestStatus: 'bad_payload',
    }
  }

  const [cCustomRes, dCustomRes] = await Promise.all([
    admin.from('custom_fields').select('*').eq('applies_to', 'contact'),
    admin.from('custom_fields').select('*').eq('applies_to', 'deal'),
  ])
  const contactCustomFields = (cCustomRes.data ?? []) as CustomField[]
  const dealCustomFields = (dCustomRes.data ?? []) as CustomField[]

  const mapped: MappedPayload = applyMapping(
    payload,
    webhook.field_mappings as WebhookFieldMappings,
    contactCustomFields,
    dealCustomFields,
    webhook.creates_deal,
  )

  const phoneRaw = mapped.contact.standard.phone
  const normalizedPhone = phoneRaw?.trim() ? normalizePhone(String(phoneRaw)) : null
  const emailRaw = mapped.contact.standard.email
  const normalizedEmail = emailRaw?.trim() ? String(emailRaw).trim().toLowerCase() : null

  if (!normalizedPhone && !normalizedEmail) {
    await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'bad_payload', {
      error_message: 'Payload must include at least phone or email',
    })
    return {
      status: 'skipped',
      errorMessage: 'Payload must include at least phone or email',
      result: {},
      webhookRequestStatus: 'bad_payload',
    }
  }

  const { data: existing } = await admin.from('contacts').select('*')
  const allContacts = (existing ?? []) as Array<Record<string, unknown>>

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

  let resolvedContactAssignedTo: string | null = null
  let contactId: string
  let isNewContact = false

  if (existingMatch) {
    const patch: Record<string, unknown> = {}
    if (!existingMatch.name && mapped.contact.standard.name) {
      patch.name = mapped.contact.standard.name
    }
    if (!existingMatch.phone && normalizedPhone) patch.phone = normalizedPhone
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
        await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'error', {
          error_message: 'Contact update failed',
        })
        return {
          status: 'error',
          errorMessage: 'Contact update failed',
          result: {},
          webhookRequestStatus: 'error',
        }
      }
    }
    contactId = existingMatch.id as string
    resolvedContactAssignedTo = (existingMatch.assigned_to as string | null) ?? null
  } else {
    isNewContact = true
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
      await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'error', {
        error_message: `Contact insert failed: ${msg}`,
      })
      return {
        status: 'error',
        errorMessage: `Contact insert failed: ${msg}`,
        result: {},
        webhookRequestStatus: 'error',
      }
    }
  }

  let dealId: string | null = null
  if (webhook.creates_deal && webhook.pipeline_id && webhook.stage_id && mapped.deal) {
    const dealAssignedTo =
      resolvedContactAssignedTo ?? (await pickNextAssignee(webhookId, admin))
    const dealTitle =
      mapped.deal.standard.title?.trim() ||
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
      await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'error', {
        created_contact_id: contactId,
        error_message: `Deal insert failed: ${msg}`,
      })
      return {
        status: 'error',
        errorMessage: `Deal insert failed: ${msg}`,
        result: { contact_id: contactId, is_new_contact: isNewContact },
        webhookRequestStatus: 'error',
      }
    }
  }

  await logWebhookRequest(admin, webhookId, event.id, ipAddress, rawBody, 'ok', {
    created_contact_id: contactId,
    created_deal_id: dealId,
  })

  return {
    status: 'success',
    result: {
      contact_id: contactId,
      deal_id: dealId,
      deduplicated: !isNewContact,
      is_new_contact: isNewContact,
    },
    webhookRequestStatus: 'ok',
  }
}

/** Validate secret at ingress time (not in worker). */
export function validateIntegrationWebhookSecret(
  webhook: Webhook,
  presentedSecret: string,
): { ok: true } | { ok: false; reason: string } {
  try {
    const storedRaw = decryptSecret(webhook.secret_encrypted)
    if (!presentedSecret || !secretsMatch(presentedSecret, storedRaw)) {
      return { ok: false, reason: 'Invalid secret' }
    }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'Secret decrypt failed' }
  }
}
