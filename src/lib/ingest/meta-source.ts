import type { SupabaseClient } from '@supabase/supabase-js'

const FB_LEADS_SOURCE_NAME = 'Facebook'
const FB_LEADS_SOURCE_KEY = 'facebook'

export async function getOrCreateFacebookLeadsSource(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data: byKey } = await admin
    .from('sources')
    .select('id')
    .eq('key', FB_LEADS_SOURCE_KEY)
    .maybeSingle()

  if (byKey) return byKey.id

  const { data: byName } = await admin
    .from('sources')
    .select('id')
    .eq('name', FB_LEADS_SOURCE_NAME)
    .maybeSingle()

  if (byName) return byName.id

  const { data: created, error } = await admin
    .from('sources')
    .insert({
      name: FB_LEADS_SOURCE_NAME,
      key: FB_LEADS_SOURCE_KEY,
      sort_order: 10,
    })
    .select('id')
    .single()

  if (error) {
    const { data: raced } = await admin
      .from('sources')
      .select('id')
      .eq('key', FB_LEADS_SOURCE_KEY)
      .maybeSingle()
    if (raced) return raced.id
    console.error('[ingest/meta] failed to create source:', error.message)
    return null
  }
  return created.id
}
