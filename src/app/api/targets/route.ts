import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { getVisibleProfileIds } from '@/lib/reports/visible-profiles'

/**
 * /api/targets — per-rep monthly sales targets (quotas).
 *
 * GET  ?month=YYYY-MM[-01]   list targets (RLS-scoped: reps see own).
 * POST { profile_id, period_month, metric?, target_value }  upsert one target.
 * DELETE ?id=...            remove a target.
 *
 * Writes are limited to admin/owner/manager; managers may only set targets
 * for reps within their visible set.
 */

const METRICS = ['revenue_won', 'deals_won'] as const
type Metric = (typeof METRICS)[number]

/** Normalise any date-ish input to the first day of its month (UTC). */
function firstOfMonth(input: string): string | null {
  const d = new Date(input.length === 7 ? `${input}-01` : input)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export async function GET(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const supabase = await createClient()
  const url = new URL(request.url)
  const month = url.searchParams.get('month')

  let query = supabase.from('targets').select('*')
  if (month) {
    const normalised = firstOfMonth(month)
    if (!normalised) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
    query = query.eq('period_month', normalised)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ targets: data ?? [] })
}

export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: { profile_id?: string; period_month?: string; metric?: string; target_value?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.profile_id) return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
  if (!body.period_month) return NextResponse.json({ error: 'period_month is required' }, { status: 400 })

  const period = firstOfMonth(body.period_month)
  if (!period) return NextResponse.json({ error: 'Invalid period_month' }, { status: 400 })

  const metric = (body.metric ?? 'revenue_won') as Metric
  if (!METRICS.includes(metric)) return NextResponse.json({ error: 'Invalid metric' }, { status: 400 })

  const value = Number(body.target_value ?? 0)
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: 'target_value must be a non-negative number' }, { status: 400 })
  }

  const supabase = await createClient()

  // Managers may only set targets for reps they can see.
  const visible = await getVisibleProfileIds(supabase, caller.profileId, caller.role)
  if (!visible.includes(body.profile_id)) {
    return NextResponse.json({ error: 'You cannot set a target for this user' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('targets')
    .upsert(
      {
        profile_id: body.profile_id,
        period_month: period,
        metric,
        target_value: value,
        created_by: caller.profileId,
      },
      { onConflict: 'profile_id,period_month,metric' },
    )
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ target: data }, { status: 200 })
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('targets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
