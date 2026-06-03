import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

/**
 * /api/sla-settings — the single-row first-response SLA config.
 *
 * GET    read current settings (any authed user).
 * PATCH  update enabled / first_response_minutes (admin/owner only).
 */

export async function GET(): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sla_settings')
    .select('enabled, first_response_minutes, updated_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data ?? { enabled: true, first_response_minutes: 15 } })
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: { enabled?: boolean; first_response_minutes?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_by: caller.profileId, updated_at: new Date().toISOString() }
  if (typeof body.enabled === 'boolean') updates.enabled = body.enabled
  if (body.first_response_minutes != null) {
    const mins = Number(body.first_response_minutes)
    if (!Number.isInteger(mins) || mins < 1) {
      return NextResponse.json({ error: 'first_response_minutes must be a positive integer' }, { status: 400 })
    }
    updates.first_response_minutes = mins
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sla_settings')
    .update(updates)
    .eq('id', 1)
    .select('enabled, first_response_minutes, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
