import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { dispatchNotification } from '@/lib/notifications/service'

/**
 * POST /api/contacts/[id]/note  { note_text, mention_profile_ids?: string[] }
 *
 * Adds a contact note and notifies any @mentioned teammates (in-app/email)
 * so leads can be handed over with context. Dispatch runs server-side
 * because users can't write notifications for other users under RLS.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  const { id: contactId } = await params

  let body: { note_text?: string; mention_profile_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const noteText = (body.note_text ?? '').trim()
  if (!noteText) return NextResponse.json({ error: 'note_text is required' }, { status: 400 })

  const supabase = await createClient()

  const { error } = await supabase.from('contact_notes').insert({
    contact_id: contactId,
    user_id: caller.userId,
    note_text: noteText,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify mentioned teammates (skip self).
  const mentions = [...new Set(body.mention_profile_ids ?? [])].filter((p) => p && p !== caller.profileId)
  for (const mentionedProfileId of mentions) {
    dispatchNotification({
      type: 'note.mention',
      contactId,
      mentionedProfileId,
      actorProfileId: caller.profileId,
      noteText,
    }).catch((err) => console.error('[note mention] notify failed:', err))
  }

  return NextResponse.json({ ok: true })
}
