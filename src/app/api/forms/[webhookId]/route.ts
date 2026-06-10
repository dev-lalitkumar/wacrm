import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import type { Webhook } from '@/types'
import { checkRateLimit } from '@/lib/integrations/rate-limit'
import { recordInboundEvent } from '@/lib/ingest/record'
import { integrationIdempotencyKey } from '@/lib/ingest/idempotency'
import { sanitizeInboundHeaders } from '@/lib/ingest/headers'
import { scheduleInboundEventProcessing } from '@/lib/ingest/schedule'

/**
 * POST /api/forms/[webhookId]
 *
 * Public form submissions are queued in inbound_events and processed async.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  const { webhookId } = await params
  const admin = supabaseAdmin()
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = sanitizeInboundHeaders(request.headers)

  let body: {
    name?: string
    phone?: string
    email?: string
    company?: string
    message?: string
    website?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
  }

  if (body.website && body.website.trim() !== '') {
    return NextResponse.json({ status: 'ok' })
  }

  const rawBody = JSON.stringify(body)

  const { data: webhookRow } = await admin
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .maybeSingle()
  const webhook = webhookRow as Webhook | null
  if (!webhook || !webhook.is_active || !webhook.public_form_enabled) {
    return NextResponse.json({ error: 'This form is not available' }, { status: 404 })
  }

  const rate = await checkRateLimit(webhookId, webhook.rate_limit_per_minute, admin)
  if (!rate.allowed) {
    await recordInboundEvent(admin, {
      sourceType: 'public_form',
      sourceRef: webhookId,
      rawBody,
      headers,
      ipAddress,
      authStatus: 'rate_limited',
      status: 'rejected',
      errorMessage: 'Rate limit exceeded',
    })
    return NextResponse.json(
      { error: 'Too many submissions — try again shortly.' },
      { status: 429 },
    )
  }

  const normalizedPhone = body.phone?.trim()
  const normalizedEmail = body.email?.trim()
  if (!normalizedPhone && !normalizedEmail) {
    await recordInboundEvent(admin, {
      sourceType: 'public_form',
      sourceRef: webhookId,
      rawBody,
      headers,
      ipAddress,
      status: 'skipped',
      errorMessage: 'Missing phone and email',
    })
    return NextResponse.json({ error: 'Please provide a phone or email.' }, { status: 400 })
  }

  const idempotencyKey = integrationIdempotencyKey(webhookId, rawBody, null)

  const recorded = await recordInboundEvent(admin, {
    sourceType: 'public_form',
    sourceRef: webhookId,
    idempotencyKey,
    rawBody,
    headers,
    ipAddress,
    status: 'pending',
  })

  if (recorded.error || !recorded.eventId) {
    return NextResponse.json({ error: 'Could not submit. Please try again.' }, { status: 500 })
  }

  if (!recorded.duplicate) {
    scheduleInboundEventProcessing(recorded.eventId)
  }

  return NextResponse.json(
    { event_id: recorded.eventId, status: 'pending' },
    { status: 202 },
  )
}
