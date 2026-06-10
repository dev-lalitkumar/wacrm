import type { LeadgenWebhookPayload } from '@/lib/meta/types'

export interface MetaLeadgenChange {
  leadgenId: string
  pageId: string
  formId: string
}

export function extractMetaLeadgenChanges(body: LeadgenWebhookPayload): MetaLeadgenChange[] {
  const changes: MetaLeadgenChange[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue
      const { leadgen_id, page_id, form_id } = change.value ?? {}
      if (!leadgen_id || !page_id || !form_id) continue
      changes.push({
        leadgenId: leadgen_id,
        pageId: page_id,
        formId: form_id,
      })
    }
  }
  return changes
}
