import type { SupabaseClient } from '@supabase/supabase-js'
import type { FieldData, FieldMapping } from './types'
import { createContact, type CreateContactInput } from '@/lib/contacts/service'
import { createDeal } from '@/lib/deals/service'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'

export interface ProcessLeadInput {
  leadgenId: string
  pageId: string
  formId: string
  fieldData: FieldData[]
  sourceId: string
}

export interface ProcessLeadResult {
  contactId: string | null
  dealId: string | null
  status: 'success' | 'error' | 'skipped'
  errorMessage?: string
}

const CONTACT_FIELDS = new Set(['name', 'email', 'phone', 'company'])
const DEAL_FIELDS = new Set(['title', 'notes', 'value'])

export async function processLeadEvent(
  supabase: SupabaseClient,
  input: ProcessLeadInput,
): Promise<ProcessLeadResult> {
  const { formId, fieldData, sourceId } = input

  // Load field mappings for this form
  const { data: mappingRows, error: mapErr } = await supabase
    .from('facebook_field_mappings')
    .select('*')
    .eq('form_id', formId)

  if (mapErr) {
    return { contactId: null, dealId: null, status: 'error', errorMessage: mapErr.message }
  }

  const mappings = (mappingRows ?? []) as FieldMapping[]

  // Build a lookup: fb_field_key → mapping
  const mappingMap = new Map<string, FieldMapping>()
  for (const m of mappings) {
    mappingMap.set(m.fb_field_key, m)
  }

  // Map fieldData to contact/deal fields
  const contactFields: Partial<CreateContactInput> & { custom_data?: Record<string, unknown> } = {}
  const dealCustomData: Record<string, unknown> = {}
  const dealStandardFields: Record<string, unknown> = {}
  let hasDealMapping = false

  for (const fd of fieldData) {
    const value = fd.values[0] ?? ''
    const mapping = mappingMap.get(fd.name)
    if (!mapping) continue

    if (mapping.crm_object === 'contact') {
      if (mapping.crm_field.startsWith('custom_data.')) {
        const key = mapping.crm_field.slice('custom_data.'.length)
        if (!contactFields.custom_data) contactFields.custom_data = {}
        contactFields.custom_data[key] = value
      } else if (CONTACT_FIELDS.has(mapping.crm_field)) {
        (contactFields as Record<string, unknown>)[mapping.crm_field] = value
      }
    } else if (mapping.crm_object === 'deal') {
      hasDealMapping = true
      if (mapping.crm_field.startsWith('custom_data.')) {
        const key = mapping.crm_field.slice('custom_data.'.length)
        dealCustomData[key] = value
      } else if (DEAL_FIELDS.has(mapping.crm_field)) {
        dealStandardFields[mapping.crm_field] = value
      }
    }
  }

  // Require at least phone or email to create a contact
  const phone = (contactFields.phone as string | undefined)?.trim()
  const email = (contactFields.email as string | undefined)?.trim()

  if (!phone && !email) {
    return {
      contactId: null,
      dealId: null,
      status: 'skipped',
      errorMessage: 'No phone or email in lead data; no mapping configured for these fields',
    }
  }

  // Create contact via the central service
  let contactId: string
  try {
    const result = await createContact(supabase, {
      phone: phone ?? email ?? '',
      name: (contactFields.name as string | undefined) ?? null,
      email: email ?? null,
      company: (contactFields.company as string | undefined) ?? null,
      source_id: sourceId,
      custom_data: contactFields.custom_data ?? {},
      user_id: null,
    })
    contactId = result.id
  } catch (err) {
    return {
      contactId: null,
      dealId: null,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Contact creation failed',
    }
  }

  // Optionally create a deal if any deal fields were mapped
  let dealId: string | null = null
  if (hasDealMapping) {
    // Fetch the first stage of the fixed pipeline
    const { data: stageRow } = await supabase
      .from('pipeline_stages')
      .select('id')
      .eq('pipeline_id', FIXED_PIPELINE_ID)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (stageRow?.id) {
      try {
        const dealResult = await createDeal(supabase, {
          pipeline_id: FIXED_PIPELINE_ID,
          stage_id: stageRow.id,
          source_id: sourceId,
          contact_id: contactId,
          title: (dealStandardFields.title as string | undefined) ?? null,
          notes: (dealStandardFields.notes as string | undefined) ?? null,
          value: dealStandardFields.value ? Number(dealStandardFields.value) : 0,
          custom_data: dealCustomData,
          user_id: null,
          _contactName: (contactFields.name as string | undefined) ?? null,
          _contactPhone: phone ? normalizePhone(phone) : null,
          _fallbackTitle: 'Facebook Lead',
        })
        dealId = dealResult.id
      } catch (err) {
        console.error('[meta/lead-processor] deal creation failed:', err)
        // Contact succeeded — return partial success
      }
    }
  }

  return { contactId, dealId, status: 'success' }
}
