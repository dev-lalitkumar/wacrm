import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proposal_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  const supabase = await createClient()

  // Don't allow deleting the seeded defaults
  const { data: tpl } = await supabase.from('proposal_templates').select('is_default').eq('id', id).single()
  if (tpl?.is_default) return NextResponse.json({ error: 'Cannot delete default template' }, { status: 400 })

  const { error } = await supabase.from('proposal_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
