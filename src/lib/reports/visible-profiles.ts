import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the profile IDs whose data the caller is allowed to see.
 *
 * Hierarchy: Admin > Owner > Manager > Executive
 *
 *   admin    → all active profiles
 *   owner    → all active profiles EXCEPT admins
 *   manager  → all active managers + executives (+ own)
 *   executive → own profile only
 */
export async function getVisibleProfileIds(
  supabase: SupabaseClient,
  callerProfileId: string,
  callerRole: string,
): Promise<string[]> {
  if (callerRole === 'admin') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
    return (data ?? []).map((p: { id: string }) => p.id)
  }

  if (callerRole === 'owner') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .in('role', ['owner', 'manager', 'executive'])
    return (data ?? []).map((p: { id: string }) => p.id)
  }

  if (callerRole === 'manager') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .in('role', ['manager', 'executive'])
    const ids = (data ?? []).map((p: { id: string }) => p.id)
    return [...new Set([...ids, callerProfileId])]
  }

  // executive — own data only
  return [callerProfileId]
}
