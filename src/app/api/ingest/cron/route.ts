import { NextResponse } from 'next/server'
import { drainInboundEvents } from '@/lib/ingest/processor'

/**
 * GET /api/ingest/cron
 *
 * Backup drain for pending inbound_events. Primary processing uses after()
 * on ingress; this catches failures and stuck rows. Ping from an external
 * scheduler (cron-job.org) every 5–15 min, or add vercel.json crons on Pro.
 *
 * Auth: x-cron-secret header must match AUTOMATION_CRON_SECRET.
 */
export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret')
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workerId = `ingest-cron-${Date.now()}`
  const result = await drainInboundEvents(25, workerId)

  return NextResponse.json({
    claimed: result.claimed,
    processed: result.processed,
    results: result.results,
  })
}
