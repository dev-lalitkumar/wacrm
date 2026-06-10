import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'
import { fetchLeadData } from '@/lib/meta/facebook-api'
import { processLeadEvent } from '@/lib/meta/lead-processor'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchNotification } from '@/lib/notifications/service'
import type { LeadgenWebhookPayload } from '@/lib/meta/types'
import type { InboundEvent, InboundEventResult } from './types'
import { getOrCreateFacebookLeadsSource } from './meta-source'

export interface MetaProcessOutcome {
  status: 'success' | 'error' | 'skipped'
  errorMessage?: string
  result: InboundEventResult
}

async function logMetaWebhookLegacy(
  admin: SupabaseClient,
  opts: {
    leadgenId: string
    pageId?: string
    formId?: string
    status: 'success' | 'error' | 'skipped'
    contactId?: string
    dealId?: string
    errorMessage?: string
    rawPayload?: string
  },
) {
  try {
    await admin.from('meta_webhook_logs').insert({
      leadgen_id: opts.leadgenId,
      page_id: opts.pageId ?? null,
      form_id: opts.formId ?? null,
      status: opts.status,
      contact_id: opts.contactId ?? null,
      deal_id: opts.dealId ?? null,
      error_message: opts.errorMessage ?? null,
      raw_payload: opts.rawPayload ? JSON.parse(opts.rawPayload) : null,
    })
  } catch (err) {
    console.error('[ingest/meta] meta_webhook_logs insert failed:', err)
  }
}

export async function processMetaLeadgenEvent(
  admin: SupabaseClient,
  event: InboundEvent,
): Promise<MetaProcessOutcome> {
  const leadgenId = event.idempotency_key
  const pageId = event.source_ref
  const rawPayload = event.raw_body

  if (!leadgenId || !pageId) {
    return {
      status: 'skipped',
      errorMessage: 'Missing leadgen_id or page_id on inbound event',
      result: {},
    }
  }

  let formId: string | undefined
  try {
    const body = JSON.parse(rawPayload) as LeadgenWebhookPayload
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'leadgen') continue
        if (change.value?.leadgen_id === leadgenId) {
          formId = change.value.form_id
          break
        }
      }
    }
  } catch {
    return {
      status: 'error',
      errorMessage: 'Invalid JSON in raw_body',
      result: { leadgen_id: leadgenId, page_id: pageId },
    }
  }

  if (!formId) {
    return {
      status: 'skipped',
      errorMessage: 'Could not resolve form_id from payload',
      result: { leadgen_id: leadgenId, page_id: pageId },
    }
  }

  const sourceId = await getOrCreateFacebookLeadsSource(admin)
  if (!sourceId) {
    return {
      status: 'error',
      errorMessage: 'Could not resolve Facebook source',
      result: { leadgen_id: leadgenId, page_id: pageId, form_id: formId },
    }
  }

  const { data: pageRow } = await admin
    .from('facebook_pages')
    .select('access_token')
    .eq('id', pageId)
    .maybeSingle()

  if (!pageRow?.access_token) {
    await logMetaWebhookLegacy(admin, {
      leadgenId,
      pageId,
      formId,
      status: 'skipped',
      errorMessage: 'Page not found or not connected',
      rawPayload,
    })
    return {
      status: 'skipped',
      errorMessage: 'Page not found or not connected',
      result: { leadgen_id: leadgenId, page_id: pageId, form_id: formId },
    }
  }

  let pageToken: string
  try {
    pageToken = decrypt(pageRow.access_token)
  } catch {
    return {
      status: 'error',
      errorMessage: 'Failed to decrypt page token',
      result: { leadgen_id: leadgenId, page_id: pageId, form_id: formId },
    }
  }

  let leadData: Awaited<ReturnType<typeof fetchLeadData>>
  try {
    leadData = await fetchLeadData(leadgenId, pageToken)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logMetaWebhookLegacy(admin, {
      leadgenId,
      pageId,
      formId,
      status: 'error',
      errorMessage: `fetchLeadData failed: ${msg}`,
      rawPayload,
    })
    return {
      status: 'error',
      errorMessage: `fetchLeadData failed: ${msg}`,
      result: { leadgen_id: leadgenId, page_id: pageId, form_id: formId },
    }
  }

  const result = await processLeadEvent(admin, {
    leadgenId,
    pageId,
    formId: leadData.form_id ?? formId,
    fieldData: leadData.field_data ?? [],
    sourceId,
  })

  await logMetaWebhookLegacy(admin, {
    leadgenId,
    pageId,
    formId: leadData.form_id ?? formId,
    status: result.status === 'success' ? 'success' : result.status,
    contactId: result.contactId ?? undefined,
    dealId: result.dealId ?? undefined,
    errorMessage: result.errorMessage,
    rawPayload,
  })

  if (result.status === 'success' && result.contactId) {
    const contactId = result.contactId
    if (!result.deduplicated) {
      runAutomationsForTrigger({
        userId: 'facebook-lead-webhook',
        triggerType: 'new_contact_created',
        contactId,
        context: { vars: { source: 'facebook_leads', leadgen_id: leadgenId } },
      }).catch((err) => console.error('[ingest/meta] automation failed:', err))

      const contactAssignee =
        result.assigneeId ??
        (
          await admin.from('contacts').select('assigned_to').eq('id', contactId).maybeSingle()
        ).data?.assigned_to

      if (contactAssignee) {
        dispatchNotification({
          type: 'contact.assigned',
          contactId,
          assigneeProfileId: contactAssignee,
        }).catch((err) => console.error('[ingest/meta] notify contact.assigned', err))
      }
    }

    if (result.dealId && result.assigneeId) {
      dispatchNotification({
        type: 'deal.assigned',
        dealId: result.dealId,
        assigneeProfileId: result.assigneeId,
      }).catch((err) => console.error('[ingest/meta] notify deal.assigned', err))
    }
  }

  return {
    status: result.status,
    errorMessage: result.errorMessage,
    result: {
      contact_id: result.contactId,
      deal_id: result.dealId,
      leadgen_id: leadgenId,
      page_id: pageId,
      form_id: leadData.form_id ?? formId,
      deduplicated: result.deduplicated,
    },
  }
}
