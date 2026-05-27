import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-webhook per-minute rate limit. Implemented as a single COUNT
 * over `webhook_requests` rows in the last 60 seconds — accurate
 * across processes, no Redis required. The trade-off is one DB round
 * trip per ingest before any other work; that's acceptable for a
 * lead-capture endpoint that's not on a hot path.
 *
 * Returns:
 *   { allowed: true,  count: <recent> }   → caller may proceed
 *   { allowed: false, count: <recent> }   → caller should respond 429
 *
 * Note: webhook_requests has RLS but no INSERT policy, so this must
 * be called with the service-role client (same client the ingestion
 * route uses everywhere).
 */
export async function checkRateLimit(
  webhookId: string,
  perMinute: number,
  supabase: SupabaseClient,
): Promise<{ allowed: boolean; count: number }> {
  const sinceIso = new Date(Date.now() - 60_000).toISOString()
  const { count, error } = await supabase
    .from('webhook_requests')
    .select('id', { count: 'exact', head: true })
    .eq('webhook_id', webhookId)
    .gte('received_at', sinceIso)

  if (error) {
    // If the count query itself fails (e.g. transient DB hiccup), fail
    // open — better to accept the lead than to drop it. Logged so we
    // notice if this becomes a pattern.
    console.error('[rate-limit] count query failed:', error.message)
    return { allowed: true, count: 0 }
  }

  const recent = count ?? 0
  return { allowed: recent < perMinute, count: recent }
}
