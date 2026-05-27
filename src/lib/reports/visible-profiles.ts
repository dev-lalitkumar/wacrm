import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns the profile IDs whose data the caller is allowed to see in reports.
 *
 * admin / owner → all active profiles
 * manager      → all active executives + own profile
 * executive    → own profile only
 */
export async function getVisibleProfileIds(
  supabase: SupabaseClient,
  callerProfileId: string,
  callerRole: string,
): Promise<string[]> {
  if (callerRole === 'admin' || callerRole === 'owner') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
    return (data ?? []).map((p: { id: string }) => p.id)
  }

  if (callerRole === 'manager') {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .in('role', ['executive'])
    const execIds = (data ?? []).map((p: { id: string }) => p.id)
    // Include own ID (may not be in execIds if caller is manager)
    return [...new Set([...execIds, callerProfileId])]
  }

  // executive — own data only
  return [callerProfileId]
}
