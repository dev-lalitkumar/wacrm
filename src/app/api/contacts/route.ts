import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getAuthedCaller,
  isErrorResponse,
  requireRole,
} from '@/lib/auth/require-role'
import { createContact, type CreateContactInput } from '@/lib/contacts/service'

/**
 * POST /api/contacts
 *
 * Create a new contact. Any authenticated role may create contacts.
 * Fills user_id and falls back assigned_to to the caller's profile when
 * not explicitly provided.
 *
 * Returns: { id: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: Partial<CreateContactInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.phone?.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }
  if (!body.source_id) {
    return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const result = await createContact(supabase, {
      phone: body.phone,
      name: body.name ?? null,
      email: body.email ?? null,
      company: body.company ?? null,
      source_id: body.source_id,
      assigned_to: body.assigned_to ?? caller.profileId,
      custom_data: body.custom_data ?? {},
      user_id: caller.userId,
    })

    return NextResponse.json({ id: result.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/contacts]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
