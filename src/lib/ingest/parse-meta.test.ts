import { describe, it, expect } from 'vitest'
import { extractMetaLeadgenChanges } from './parse-meta'
import type { LeadgenWebhookPayload } from '@/lib/meta/types'

describe('extractMetaLeadgenChanges', () => {
  it('extracts leadgen changes from a standard Meta payload', () => {
    const body: LeadgenWebhookPayload = {
      object: 'page',
      entry: [
        {
          id: '1659078187660651',
          changes: [
            {
              field: 'leadgen',
              value: {
                leadgen_id: '1513064750280280',
                page_id: '1659078187660651',
                form_id: '27245384578436730',
              },
            },
          ],
        },
      ],
    }

    const changes = extractMetaLeadgenChanges(body)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual({
      leadgenId: '1513064750280280',
      pageId: '1659078187660651',
      formId: '27245384578436730',
    })
  })

  it('ignores non-leadgen fields and incomplete values', () => {
    const body = {
      object: 'page',
      entry: [
        {
          changes: [
            { field: 'feed', value: {} },
            { field: 'leadgen', value: { leadgen_id: '1', page_id: '2' } },
          ],
        },
      ],
    } as LeadgenWebhookPayload

    expect(extractMetaLeadgenChanges(body)).toHaveLength(0)
  })

  it('returns empty array for empty entry', () => {
    expect(extractMetaLeadgenChanges({ object: 'page', entry: [] })).toEqual([])
  })
})
