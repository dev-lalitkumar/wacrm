import { supabaseAdmin } from '@/lib/supabase/admin-client'

/**
 * Append an audit entry. Fire-and-forget — never throws, so it can't break
 * the action it's recording. Written via the service role (bypasses RLS).
 */
export async function writeAuditLog(entry: {
  actorProfileId?: string | null
  actorName?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabaseAdmin().from('audit_log').insert({
      actor_profile_id: entry.actorProfileId ?? null,
      actor_name: entry.actorName ?? null,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      detail: entry.detail ?? {},
    })
  } catch (err) {
    console.error('[audit] write failed:', err)
  }
}
