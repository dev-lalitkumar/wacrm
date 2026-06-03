import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { dispatchNotification } from '@/lib/notifications/service'

/**
 * GET /api/notifications/cron
 *
 * Sweeps deals and contacts whose reminder is due today or overdue and emits
 * `reminder.due_today` / `reminder.overdue` notifications. Meant to be hit on
 * a schedule (every 15–30 min). Requires the shared `x-cron-secret` header to
 * match `AUTOMATION_CRON_SECRET` (reused — same external scheduler).
 *
 * `reminder_notified_at` is the double-fire guard: only rows where it is NULL
 * are picked up, and each is stamped after dispatch. Rescheduling a reminder
 * (via the deal/contact PATCH routes) clears the stamp to re-arm it.
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
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  let processed = 0

  const sweep = async (table: 'deals' | 'contacts') => {
    let query = admin
      .from(table)
      .select('id, assigned_to, reminder_at')
      .not('reminder_at', 'is', null)
      .not('assigned_to', 'is', null)
      .is('reminder_notified_at', null)
      .lte('reminder_at', todayEnd.toISOString())
      .limit(200)

    // Deals carry a lifecycle status; only open deals should nag.
    if (table === 'deals') query = query.eq('status', 'open')

    const { data: rows, error } = await query
    if (error) {
      console.error(`[notifications/cron] ${table} query failed:`, error.message)
      return
    }

    for (const row of rows ?? []) {
      const due = new Date(row.reminder_at as string)
      const isToday = due >= todayStart
      await dispatchNotification({
        type: isToday ? 'reminder.due_today' : 'reminder.overdue',
        entityType: table === 'deals' ? 'deal' : 'contact',
        entityId: row.id as string,
        assigneeProfileId: row.assigned_to as string,
      })
      await admin
        .from(table)
        .update({ reminder_notified_at: now.toISOString() })
        .eq('id', row.id)
      processed++
    }
  }

  await sweep('deals')
  await sweep('contacts')

  // ── SLA sweep: open leads with no first response past the threshold ──
  let slaBreaches = 0
  const { data: sla } = await admin
    .from('sla_settings')
    .select('enabled, first_response_minutes')
    .eq('id', 1)
    .maybeSingle()

  if (sla?.enabled) {
    const cutoff = new Date(now.getTime() - (sla.first_response_minutes ?? 15) * 60_000)
    const { data: breached, error: slaErr } = await admin
      .from('deals')
      .select('id, assigned_to')
      .eq('status', 'open')
      .is('first_response_at', null)
      .is('sla_breached_at', null)
      .not('assigned_to', 'is', null)
      .lt('created_at', cutoff.toISOString())
      .limit(200)

    if (slaErr) {
      console.error('[notifications/cron] sla query failed:', slaErr.message)
    } else {
      for (const row of breached ?? []) {
        await dispatchNotification({
          type: 'lead.sla_breached',
          entityType: 'deal',
          entityId: row.id as string,
          assigneeProfileId: row.assigned_to as string,
        })
        await admin
          .from('deals')
          .update({ sla_breached_at: now.toISOString() })
          .eq('id', row.id)
        slaBreaches++
      }
    }
  }

  return NextResponse.json({ ok: true, processed, slaBreaches })
}
