import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { writeAuditLog } from '@/lib/audit/log'

/**
 * POST /api/contacts/merge { survivorId, loserId }
 *
 * Merges the loser contact into the survivor: all related records (deals,
 * conversations, follow-ups, emails, calls, proposals, tags, custom values…)
 * are reassigned, the survivor's blank fields are enriched from the loser,
 * and the loser is deleted — atomically, via the merge_contacts() function.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: { survivorId?: string; loserId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.survivorId || !body.loserId) {
    return NextResponse.json({ error: 'survivorId and loserId are required' }, { status: 400 })
  }
  if (body.survivorId === body.loserId) {
    return NextResponse.json({ error: 'Cannot merge a contact into itself' }, { status: 400 })
  }

  const supabase = await createClient()
  // Runs as the caller so merge_contacts()'s internal my_role() check applies.
  const { error } = await supabase.rpc('merge_contacts', {
    p_survivor: body.survivorId,
    p_loser: body.loserId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  void writeAuditLog({
    actorProfileId: caller.profileId,
    actorName: caller.fullName,
    action: 'contact.merged',
    entityType: 'contact',
    entityId: body.survivorId,
    detail: { survivor_id: body.survivorId, loser_id: body.loserId },
  })

  return NextResponse.json({ ok: true })
}
