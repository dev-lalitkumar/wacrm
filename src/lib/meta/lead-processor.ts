import type { SupabaseClient } from '@supabase/supabase-js'
import type { FieldData, FieldMapping } from './types'
import { createContact, type CreateContactInput } from '@/lib/contacts/service'
import { createDeal } from '@/lib/deals/service'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'
import { pickNextAssigneeFromGlobalPool } from '@/lib/integrations/round-robin'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'

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
  /** true when an existing contact was enriched instead of a new one created */
  deduplicated?: boolean
  assigneeId?: string | null
}

const CONTACT_FIELDS = new Set(['name', 'email', 'phone', 'company'])
const DEAL_FIELDS = new Set(['title', 'notes', 'value'])

export async function processLeadEvent(
  supabase: SupabaseClient,
  input: ProcessLeadInput,
): Promise<ProcessLeadResult> {
  const { formId, fieldData, sourceId } = input

  const { data: mappingRows, error: mapErr } = await supabase
    .from('facebook_field_mappings')
    .select('*')
    .eq('form_id', formId)

  if (mapErr) {
    return { contactId: null, dealId: null, status: 'error', errorMessage: mapErr.message }
  }

  const mappings = (mappingRows ?? []) as FieldMapping[]
  const mappingMap = new Map<string, FieldMapping>()
  for (const m of mappings) mappingMap.set(m.fb_field_key, m)

  const contactFields: Partial<CreateContactInput> & { custom_data?: Record<string, unknown> } = {}
  const dealCustomData: Record<string, unknown> = {}
  const dealStandardFields: Record<string, unknown> = {}

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
      if (mapping.crm_field.startsWith('custom_data.')) {
        const key = mapping.crm_field.slice('custom_data.'.length)
        dealCustomData[key] = value
      } else if (DEAL_FIELDS.has(mapping.crm_field)) {
        dealStandardFields[mapping.crm_field] = value
      }
    }
  }

  const phone = (contactFields.phone as string | undefined)?.trim()
  const email = (contactFields.email as string | undefined)?.trim()
  const name = (contactFields.name as string | undefined)?.trim() ?? null
  const company = (contactFields.company as string | undefined)?.trim() ?? null

  if (!phone && !email) {
    return {
      contactId: null,
      dealId: null,
      status: 'skipped',
      errorMessage: 'No phone or email in lead data; map at least one of these fields',
    }
  }

  const normalizedPhone = phone ? normalizePhone(phone) : null
  const normalizedEmail = email ? email.toLowerCase() : null

  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, phone, email, name, company, assigned_to, custom_data')

  type ContactRow = {
    id: string
    phone: string | null
    email: string | null
    name: string | null
    company: string | null
    assigned_to: string | null
    custom_data: Record<string, unknown> | null
  }

  const contacts = (allContacts ?? []) as ContactRow[]

  const existing: ContactRow | null =
    (normalizedPhone
      ? contacts.find((c) => c.phone ? phonesMatch(c.phone, normalizedPhone) : false)
      : null) ??
    (normalizedEmail
      ? contacts.find((c) => c.email && c.email.toLowerCase() === normalizedEmail)
      : null) ??
    null

  let contactId: string
  let deduplicated = false
  let assigneeId: string | null = null

  if (existing) {
    deduplicated = true
    assigneeId = existing.assigned_to
    const patch: Record<string, unknown> = {}
    if (!existing.name && name) patch.name = name
    if (!existing.phone && normalizedPhone) patch.phone = normalizedPhone
    if (!existing.email && normalizedEmail) patch.email = normalizedEmail
    if (!existing.company && company) patch.company = company
    if (contactFields.custom_data && Object.keys(contactFields.custom_data).length > 0) {
      patch.custom_data = {
        ...(existing.custom_data ?? {}),
        ...contactFields.custom_data,
      }
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()
      await supabase.from('contacts').update(patch).eq('id', existing.id)
    }
    contactId = existing.id
  } else {
    assigneeId = await pickNextAssigneeFromGlobalPool(supabase)
    try {
      const result = await createContact(supabase, {
        phone: normalizedPhone ?? email ?? '',
        name,
        email: normalizedEmail ?? null,
        company,
        source_id: sourceId,
        assigned_to: assigneeId,
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
  }

  const dealAssignee =
    assigneeId ?? (await pickNextAssigneeFromGlobalPool(supabase))

  let dealId: string | null = null
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
        assigned_to: dealAssignee,
        custom_data: dealCustomData,
        user_id: null,
        _contactName: name,
        _contactPhone: normalizedPhone,
        _fallbackTitle: 'Facebook Lead',
      })
      dealId = dealResult.id
    } catch (err) {
      console.error('[meta/lead-processor] deal creation failed:', err)
      return {
        contactId,
        dealId: null,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Deal creation failed',
        deduplicated,
        assigneeId: dealAssignee,
      }
    }
  } else {
    return {
      contactId,
      dealId: null,
      status: 'error',
      errorMessage: 'No pipeline stage found for Facebook leads',
      deduplicated,
      assigneeId: dealAssignee,
    }
  }

  return {
    contactId,
    dealId,
    status: 'success',
    deduplicated,
    assigneeId: dealAssignee,
  }
}
