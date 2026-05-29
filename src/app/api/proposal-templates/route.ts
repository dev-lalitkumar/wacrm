import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

export async function GET(): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proposal_templates')
    .select('*')
    .order('channel')
    .order('is_default', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.channel || !body.name || !body.body) {
    return NextResponse.json({ error: 'channel, name, body are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proposal_templates')
    .insert({
      user_id: caller.userId,
      created_by: caller.profileId,
      channel: body.channel,
      name: body.name,
      subject: body.subject ?? null,
      body: body.body,
      is_default: body.is_default ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
