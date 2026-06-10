import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createContact, createDeal, pickNextAssigneeFromGlobalPool } = vi.hoisted(() => ({
  createContact: vi.fn(async () => ({ id: 'contact-new' })),
  createDeal: vi.fn(async () => ({ id: 'deal-new' })),
  pickNextAssigneeFromGlobalPool: vi.fn(async () => 'assignee-rr'),
}))

vi.mock('@/lib/contacts/service', () => ({ createContact }))
vi.mock('@/lib/deals/service', () => ({
  createDeal,
  deriveDealTitle: (_n: unknown, _p: unknown, fallback?: string) => fallback ?? 'Facebook Lead',
}))
vi.mock('@/lib/integrations/round-robin', () => ({
  pickNextAssigneeFromGlobalPool,
}))

import { processLeadEvent } from './lead-processor'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'

function makeSupabase(opts: {
  mappings: Array<{ fb_field_key: string; crm_object: string; crm_field: string }>
  contacts?: Array<{
    id: string
    phone: string | null
    email: string | null
    name: string | null
    company: string | null
    assigned_to: string | null
    custom_data: Record<string, unknown> | null
  }>
  stageId?: string
}) {
  const stageId = opts.stageId ?? 'stage-1'
  return {
    from(table: string) {
      const api = {
        select: () => api,
        eq: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'pipeline_stages' ? { id: stageId } : null,
            error: null,
          }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        then: (
          onF: (v: { data: unknown; error: null }) => unknown,
          onR?: (e: unknown) => unknown,
        ) => {
          let data: unknown = []
          if (table === 'facebook_field_mappings') {
            data = opts.mappings.map((m, i) => ({
              id: `map-${i}`,
              form_id: 'form-1',
              ...m,
            }))
          } else if (table === 'contacts') {
            data = opts.contacts ?? []
          }
          return Promise.resolve({ data, error: null }).then(onF, onR)
        },
      }
      return api
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('processLeadEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates contact and deal with round-robin assignee for a new lead', async () => {
    const supabase = makeSupabase({
      mappings: [
        { fb_field_key: 'email', crm_object: 'contact', crm_field: 'email' },
        { fb_field_key: 'full_name', crm_object: 'contact', crm_field: 'name' },
      ],
    })

    const result = await processLeadEvent(supabase, {
      leadgenId: 'lead-1',
      pageId: 'page-1',
      formId: 'form-1',
      sourceId: 'source-fb',
      fieldData: [
        { name: 'email', values: ['lead@example.com'] },
        { name: 'full_name', values: ['Jane Doe'] },
      ],
    })

    expect(result.status).toBe('success')
    expect(result.contactId).toBe('contact-new')
    expect(result.dealId).toBe('deal-new')
    expect(result.deduplicated).toBe(false)
    expect(result.assigneeId).toBe('assignee-rr')

    expect(createContact).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        email: 'lead@example.com',
        name: 'Jane Doe',
        assigned_to: 'assignee-rr',
        source_id: 'source-fb',
      }),
    )

    expect(createDeal).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        contact_id: 'contact-new',
        pipeline_id: FIXED_PIPELINE_ID,
        stage_id: 'stage-1',
        assigned_to: 'assignee-rr',
        source_id: 'source-fb',
      }),
    )
  })

  it('always creates a deal even without deal field mappings', async () => {
    const supabase = makeSupabase({
      mappings: [{ fb_field_key: 'phone', crm_object: 'contact', crm_field: 'phone' }],
    })

    const result = await processLeadEvent(supabase, {
      leadgenId: 'lead-2',
      pageId: 'page-1',
      formId: 'form-1',
      sourceId: 'source-fb',
      fieldData: [{ name: 'phone', values: ['+15551234567'] }],
    })

    expect(result.status).toBe('success')
    expect(createDeal).toHaveBeenCalledTimes(1)
  })

  it('inherits existing contact assignee when deduplicating', async () => {
    const supabase = makeSupabase({
      mappings: [{ fb_field_key: 'email', crm_object: 'contact', crm_field: 'email' }],
      contacts: [
        {
          id: 'contact-existing',
          phone: null,
          email: 'existing@example.com',
          name: 'Existing',
          company: null,
          assigned_to: 'assignee-existing',
          custom_data: {},
        },
      ],
    })

    const result = await processLeadEvent(supabase, {
      leadgenId: 'lead-3',
      pageId: 'page-1',
      formId: 'form-1',
      sourceId: 'source-fb',
      fieldData: [{ name: 'email', values: ['existing@example.com'] }],
    })

    expect(result.status).toBe('success')
    expect(result.deduplicated).toBe(true)
    expect(result.contactId).toBe('contact-existing')
    expect(createContact).not.toHaveBeenCalled()
    expect(createDeal).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ assigned_to: 'assignee-existing' }),
    )
  })

  it('skips when phone and email are not mapped', async () => {
    const supabase = makeSupabase({
      mappings: [{ fb_field_key: 'company', crm_object: 'contact', crm_field: 'company' }],
    })

    const result = await processLeadEvent(supabase, {
      leadgenId: 'lead-4',
      pageId: 'page-1',
      formId: 'form-1',
      sourceId: 'source-fb',
      fieldData: [{ name: 'company', values: ['Acme Inc'] }],
    })

    expect(result.status).toBe('skipped')
    expect(createContact).not.toHaveBeenCalled()
    expect(createDeal).not.toHaveBeenCalled()
  })
})
