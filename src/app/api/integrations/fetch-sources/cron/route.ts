import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { pollSource } from '@/lib/integrations/fetch-engine'
import type { LeadFetchSource } from '@/types'

/**
 * Poll every active lead-fetch source that is due. Meant to be hit on a
 * 1-minute schedule (Vercel Cron / external pinger) — requires the shared
 * `x-cron-secret` header matching `AUTOMATION_CRON_SECRET` (reused; no new
 * secret). Per-source `next_poll_at` honours the 1/5/10/20-minute cadences.
 *
 * Overlap-safe: each source is "claimed" by conditionally bumping its
 * `next_poll_at` forward before running, so two overlapping pings can't both
 * process the same source.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  if (request.headers.get('x-cron-secret') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const { data: active, error } = await admin
    .from('lead_fetch_sources')
    .select('*')
    .eq('is_active', true)
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const due = (active ?? []).filter(
    (s) => !s.next_poll_at || new Date(s.next_poll_at as string).getTime() <= now,
  ) as LeadFetchSource[]

  let polled = 0
  let created = 0
  let skipped = 0

  for (const source of due) {
    // Claim: push next_poll_at forward, but only if it is still the value we
    // read. If another invocation already claimed it, the update affects no
    // row and we skip. pollSource's finalize() resets next_poll_at afterwards.
    const claimNext = new Date(
      now + source.poll_interval_minutes * 60_000,
    ).toISOString()
    let claimQuery = admin
      .from('lead_fetch_sources')
      .update({ next_poll_at: claimNext })
      .eq('id', source.id)
    claimQuery = source.next_poll_at
      ? claimQuery.eq('next_poll_at', source.next_poll_at)
      : claimQuery.is('next_poll_at', null)
    const { data: claimed } = await claimQuery.select('id').maybeSingle()
    if (!claimed) continue

    const summary = await pollSource(admin, source)
    polled++
    created += summary.items_created
    skipped += summary.items_skipped
  }

  return NextResponse.json({ polled, created, skipped })
}
