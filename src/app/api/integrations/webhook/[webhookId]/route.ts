import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import type { Webhook } from '@/types'
import { checkRateLimit } from '@/lib/integrations/rate-limit'
import { recordInboundEvent, findDuplicateIntegrationEvent } from '@/lib/ingest/record'
import { integrationIdempotencyKey } from '@/lib/ingest/idempotency'
import { validateIntegrationWebhookSecret } from '@/lib/ingest/integration-processor'
import { sanitizeInboundHeaders } from '@/lib/ingest/headers'
import { scheduleInboundEventProcessing } from '@/lib/ingest/schedule'

const PAYLOAD_PREVIEW_BYTES = 1024

/**
 * POST /api/integrations/webhook/[webhookId]
 *
 * Validates auth, queues the payload in inbound_events, returns 202.
 * Contact/deal creation runs immediately via after(); cron is backup.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const admin = supabaseAdmin()
  const rawBody = await request.text()
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = sanitizeInboundHeaders(request.headers)

  async function logRejected(
    status: 'disabled' | 'invalid_secret' | 'rate_limited' | 'bad_payload',
    errorMessage: string,
  ) {
    await recordInboundEvent(admin, {
      sourceType: 'integration_webhook',
      sourceRef: webhookId,
      rawBody: rawBody.slice(0, PAYLOAD_PREVIEW_BYTES),
      headers,
      ipAddress,
      authStatus:
        status === 'invalid_secret'
          ? 'invalid_secret'
          : status === 'rate_limited'
            ? 'rate_limited'
            : status === 'disabled'
              ? 'disabled'
              : 'ok',
      status: 'rejected',
      errorMessage,
    })
  }

  const { data: webhookRow, error: whErr } = await admin
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .maybeSingle()

  if (whErr || !webhookRow) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }
  const webhook = webhookRow as Webhook

  if (!webhook.is_active) {
    await logRejected('disabled', 'Webhook is disabled')
    return NextResponse.json({ error: 'Webhook is disabled' }, { status: 403 })
  }

  const presented = request.headers.get('x-webhook-secret') ?? ''
  const secretCheck = validateIntegrationWebhookSecret(webhook, presented)
  if (!secretCheck.ok) {
    await logRejected('invalid_secret', secretCheck.reason)
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const rate = await checkRateLimit(webhookId, webhook.rate_limit_per_minute, admin)
  if (!rate.allowed) {
    await logRejected(
      'rate_limited',
      `${rate.count} requests in the last minute (limit ${webhook.rate_limit_per_minute})`,
    )
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  try {
    JSON.parse(rawBody)
  } catch {
    await logRejected('bad_payload', 'Invalid JSON')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const idempotencyKey = integrationIdempotencyKey(
    webhookId,
    rawBody,
    request.headers.get('x-idempotency-key'),
  )

  const existingId = await findDuplicateIntegrationEvent(
    admin,
    'integration_webhook',
    idempotencyKey,
  )
  if (existingId) {
    return NextResponse.json(
      { event_id: existingId, status: 'success', duplicate: true },
      { status: 200 },
    )
  }

  const recorded = await recordInboundEvent(admin, {
    sourceType: 'integration_webhook',
    sourceRef: webhookId,
    idempotencyKey,
    rawBody,
    headers,
    ipAddress,
    status: 'pending',
  })

  if (recorded.error || !recorded.eventId) {
    return NextResponse.json({ error: 'Failed to queue event' }, { status: 500 })
  }

  if (recorded.duplicate) {
    return NextResponse.json(
      { event_id: recorded.eventId, status: 'pending', duplicate: true },
      { status: 202 },
    )
  }

  scheduleInboundEventProcessing(recorded.eventId)

  return NextResponse.json(
    { event_id: recorded.eventId, status: 'pending' },
    { status: 202 },
  )
}
