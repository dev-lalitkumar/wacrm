import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '@/types'

/**
 * Returns the profiles the caller is allowed to filter/select as an
 * assignee. Mirrors the role-scoping rules used by the reports module
 * (see `src/lib/reports/visible-profiles.ts`):
 *
 *   admin / owner → all active profiles
 *   manager      → all active executives + own profile
 *   executive    → []  (UI hides the filter for them anyway)
 */
export async function getAssignableProfiles(
  supabase: SupabaseClient,
  callerProfileId: string,
  callerRole: string,
): Promise<Profile[]> {
  if (callerRole === 'admin' || callerRole === 'owner') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('is_active', true)
      .order('full_name')
    return (data ?? []) as Profile[]
  }

  if (callerRole === 'manager') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('is_active', true)
      .or(`role.eq.executive,id.eq.${callerProfileId}`)
      .order('full_name')
    return (data ?? []) as Profile[]
  }

  return []
}
