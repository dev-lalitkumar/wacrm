import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Public (no-auth) endpoint for client-side proposal actions.
 * Identified by public_token, not proposal ID.
 *
 * PATCH /api/proposals/[id]/public  { action: 'viewed' | 'accepted' | 'rejected', token: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  let body: { action: string; token: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.token) return NextResponse.json({ error: 'token is required' }, { status: 400 })
  if (!['viewed', 'accepted', 'rejected'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('id, status, public_token, viewed_at')
    .eq('id', id)
    .eq('public_token', body.token)
    .single()

  if (error || !proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const updates: Record<string, string> = { updated_at: now }

  const proposalData = proposal as { id: string; status: string; public_token: string; viewed_at: string | null }
  if (body.action === 'viewed' && !proposalData.viewed_at) {
    updates.viewed_at = now
    if (proposalData.status === 'sent') updates.status = 'viewed'
  } else if (body.action === 'accepted') {
    updates.status = 'accepted'
    updates.accepted_at = now
  } else if (body.action === 'rejected') {
    updates.status = 'rejected'
    updates.rejected_at = now
  }

  await supabase.from('proposals').update(updates).eq('id', id)

  await supabase.from('proposal_history').insert({
    proposal_id: id,
    action: body.action,
    channel: 'web',
  })

  return NextResponse.json({ ok: true })
}
