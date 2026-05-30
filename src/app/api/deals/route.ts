import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isErrorResponse,
  requireRole,
} from '@/lib/auth/require-role'
import { createDeal, type CreateDealInput } from '@/lib/deals/service'

/**
 * POST /api/deals
 *
 * Create a new deal. Any authenticated role may create deals.
 * Fills user_id and falls back assigned_to to the caller's profile when
 * not explicitly provided.
 *
 * Returns: { id: string }
 */
export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: Partial<CreateDealInput>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.contact_id) {
    return NextResponse.json({ error: 'contact_id is required — every deal must belong to a contact' }, { status: 400 })
  }
  if (!body.pipeline_id) {
    return NextResponse.json({ error: 'pipeline_id is required' }, { status: 400 })
  }
  if (!body.stage_id) {
    return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })
  }
  if (!body.source_id) {
    return NextResponse.json({ error: 'source_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const result = await createDeal(supabase, {
      pipeline_id: body.pipeline_id,
      stage_id: body.stage_id,
      source_id: body.source_id,
      title: body.title ?? null,
      contact_id: body.contact_id,
      value: body.value ?? 0,
      currency: body.currency ?? 'USD',
      expected_close_date: body.expected_close_date ?? null,
      notes: body.notes ?? null,
      assigned_to: body.assigned_to ?? caller.profileId,
      custom_data: body.custom_data ?? {},
      user_id: caller.userId,
      _contactName: body._contactName ?? null,
      _contactPhone: body._contactPhone ?? null,
      _fallbackTitle: body._fallbackTitle,
    })

    return NextResponse.json({ id: result.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/deals]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
