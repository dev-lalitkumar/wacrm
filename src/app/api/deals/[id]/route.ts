import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { dispatchNotification } from '@/lib/notifications/service'

/**
 * PATCH /api/deals/[id]
 *
 * Central update path for a deal. Applies the change under the caller's RLS
 * scope, then dispatches notifications for any meaningful transition
 * (stage change, reassignment, won/lost). Routing deal mutations through
 * here — instead of direct client-side Supabase writes — is what lets the
 * server-side notification service observe the change.
 *
 * Accepts any subset of the editable columns. Returns { ok, deal }.
 */

// Columns a client is allowed to set directly.
const EDITABLE = [
  'title',
  'value',
  'currency',
  'stage_id',
  'assigned_to',
  'status',
  'lost_reason_id',
  'closed_by',
  'expected_close_date',
  'notes',
  'custom_data',
  'reminder_at',
  'reminder_type',
  'reminder_note',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch current values for diffing (RLS scopes this to deals the caller can see).
  const { data: before, error: fetchError } = await supabase
    .from('deals')
    .select('id, stage_id, assigned_to, status, reminder_at')
    .eq('id', id)
    .single()

  if (fetchError || !before) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
  }

  // Build the update payload from whitelisted fields only.
  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  // Every deal must keep an owner — never let an update clear it.
  if ('assigned_to' in updates && !updates.assigned_to) {
    return NextResponse.json({ error: 'assigned_to cannot be empty — a deal must always be assigned' }, { status: 400 })
  }

  // A lead must never go dark: an open deal must always keep a future reminder.
  // The only way to resolve a reminder is to schedule the next one. (The DB has a
  // backstop trigger; this gives the client a friendly message first.) Clearing is
  // allowed only when the deal is being closed in the same update (won/lost).
  const resultingStatus = ('status' in updates ? updates.status : before.status) as string
  if ('reminder_at' in updates && !updates.reminder_at && resultingStatus === 'open') {
    return NextResponse.json(
      { error: 'Open deals must keep a reminder — schedule the next step before clearing the current one' },
      { status: 400 },
    )
  }

  // Rescheduling a reminder re-arms the cron.
  if ('reminder_at' in updates && updates.reminder_at !== before.reminder_at) {
    updates.reminder_notified_at = null
  }
  updates.updated_at = new Date().toISOString()

  const { data: after, error: updateError } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !after) {
    return NextResponse.json(
      { error: updateError?.message ?? 'Update failed' },
      { status: 500 },
    )
  }

  // ── Dispatch notifications for meaningful transitions (fire-and-forget) ──
  const dispatches: Promise<void>[] = []

  if ('stage_id' in updates && after.stage_id && after.stage_id !== before.stage_id) {
    dispatches.push(
      dispatchNotification({ type: 'deal.stage_changed', dealId: id, stageId: after.stage_id }),
    )
  }

  if ('assigned_to' in updates && after.assigned_to && after.assigned_to !== before.assigned_to) {
    dispatches.push(
      dispatchNotification({
        type: 'deal.assigned',
        dealId: id,
        assigneeProfileId: after.assigned_to,
        assignerProfileId: caller.profileId,
      }),
    )
  }

  if ('status' in updates && after.status !== before.status) {
    if (after.status === 'won') {
      dispatches.push(dispatchNotification({ type: 'deal.closed_won', dealId: id }))
    } else if (after.status === 'lost') {
      dispatches.push(dispatchNotification({ type: 'deal.closed_lost', dealId: id }))
    }
  }

  Promise.all(dispatches).catch((err) => console.error('[PATCH /api/deals/:id] notify', err))

  return NextResponse.json({ ok: true, deal: after })
}
