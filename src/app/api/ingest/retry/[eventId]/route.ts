import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { processInboundEvent, requeueInboundEvent } from '@/lib/ingest/processor'

/**
 * POST /api/ingest/retry/[eventId]
 *
 * Admin UI: requeue a failed/skipped event and process immediately.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const { eventId } = await params
  const requeued = await requeueInboundEvent(eventId)
  if (!requeued) {
    return NextResponse.json(
      { error: 'Event not found or not retryable' },
      { status: 400 },
    )
  }

  const result = await processInboundEvent(eventId)
  return NextResponse.json(result)
}
