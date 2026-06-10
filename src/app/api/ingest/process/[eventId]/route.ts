import { NextResponse } from 'next/server'
import { processInboundEvent, requeueInboundEvent } from '@/lib/ingest/processor'

/**
 * POST /api/ingest/process/[eventId]
 *
 * Manually process or requeue a single inbound event (admin tooling / UI retry).
 * Auth: x-cron-secret = AUTOMATION_CRON_SECRET
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const supplied = request.headers.get('x-cron-secret')
  if (supplied !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { eventId } = await params
  const body = await request.json().catch(() => ({})) as { requeue?: boolean }

  if (body.requeue) {
    const ok = await requeueInboundEvent(eventId)
    if (!ok) {
      return NextResponse.json({ error: 'Requeue failed' }, { status: 400 })
    }
  }

  const result = await processInboundEvent(eventId)
  return NextResponse.json(result)
}
