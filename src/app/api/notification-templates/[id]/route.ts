import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

/**
 * PATCH  /api/notification-templates/[id]  — update name/title/body/is_active
 * DELETE /api/notification-templates/[id]  — remove a template
 *
 * Admin/owner only. The event_type and channel are immutable (a template's
 * identity); only its content and active flag can change.
 */

const EDITABLE = ['name', 'title', 'body', 'is_active'] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key]
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, template: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('notification_templates').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
