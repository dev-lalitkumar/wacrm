import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/encryption'

export async function getPageAccessToken(
  supabase: SupabaseClient,
  pageId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('facebook_pages')
    .select('access_token')
    .eq('id', pageId)
    .maybeSingle()

  if (!data?.access_token) return null
  return decrypt(data.access_token)
}

export async function getFacebookUserToken(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('facebook_config')
    .select('user_token, status')
    .eq('id', 1)
    .maybeSingle()

  if (!data?.user_token || data.status !== 'connected') return null
  return decrypt(data.user_token)
}
