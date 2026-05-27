import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Atomically pick the next assignee for a webhook. Delegates to the
 * SECURITY DEFINER SQL function `pick_next_assignee` (migration 015),
 * which holds a row lock while rotating the cursor.
 *
 * Priority:
 *   1. Webhook's own override pool (when `round_robin_override=true` AND non-empty)
 *   2. Global pool (when `round_robin_config.enabled=true` AND non-empty)
 *   3. NULL — caller leaves `assigned_to` unset (admin can reassign manually)
 *
 * Returns `null` on RPC error too — we never want round-robin failure
 * to break ingestion. The created row is just left unassigned.
 */
export async function pickNextAssignee(
  webhookId: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('pick_next_assignee', {
    p_webhook_id: webhookId,
  })
  if (error) {
    console.error('[round-robin] pick_next_assignee failed:', error.message)
    return null
  }
  return (data as string | null) ?? null
}
