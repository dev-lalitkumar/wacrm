import type { SupabaseClient } from '@supabase/supabase-js'
import type { GraphLeadFormResult } from './types'

export function leadFormRowsForPage(
  pageId: string,
  forms: GraphLeadFormResult[],
) {
  return forms.map((f) => ({
    id: f.id,
    page_id: pageId,
    name: f.name,
    questions: (f.questions ?? []).map((q) => ({
      key: q.key,
      label: q.label,
      type: q.type,
    })),
    updated_at: new Date().toISOString(),
  }))
}

export async function upsertLeadForms(
  supabase: SupabaseClient,
  pageId: string,
  forms: GraphLeadFormResult[],
): Promise<{ synced_count: number; error?: string }> {
  if (forms.length === 0) {
    return { synced_count: 0 }
  }

  const formRows = leadFormRowsForPage(pageId, forms)
  const { error } = await supabase
    .from('facebook_lead_forms')
    .upsert(formRows, { onConflict: 'id', ignoreDuplicates: false })

  if (error) {
    return { synced_count: 0, error: error.message }
  }

  return { synced_count: forms.length }
}
