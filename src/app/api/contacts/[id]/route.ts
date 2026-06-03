import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { dispatchNotification } from '@/lib/notifications/service'

/**
 * PATCH /api/contacts/[id]
 *
 * Central update path for a contact. Applies the change under the caller's
 * RLS scope, then dispatches a `contact.assigned` notification when the
 * assignee changes. Rescheduling a reminder re-arms the cron.
 *
 * Accepts any subset of the editable columns. Returns { ok, contact }.
 */

const EDITABLE = [
  'name',
  'phone',
  'email',
  'company',
  'avatar_url',
  'assigned_to',
  'custom_data',
  'lead_status',
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

  const { data: before, error: fetchError } = await supabase
    .from('contacts')
    .select('id, assigned_to, reminder_at')
    .eq('id', id)
    .single()

  if (fetchError || !before) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  // Every contact must keep an owner — never let an update clear it.
  if ('assigned_to' in updates && !updates.assigned_to) {
    return NextResponse.json({ error: 'assigned_to cannot be empty — a contact must always be assigned' }, { status: 400 })
  }

  if ('reminder_at' in updates && updates.reminder_at !== before.reminder_at) {
    updates.reminder_notified_at = null
  }
  updates.updated_at = new Date().toISOString()

  const { data: after, error: updateError } = await supabase
    .from('contacts')
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

  if ('assigned_to' in updates && after.assigned_to && after.assigned_to !== before.assigned_to) {
    dispatchNotification({
      type: 'contact.assigned',
      contactId: id,
      assigneeProfileId: after.assigned_to,
      assignerProfileId: caller.profileId,
    }).catch((err) => console.error('[PATCH /api/contacts/:id] notify', err))
  }

  return NextResponse.json({ ok: true, contact: after })
}
