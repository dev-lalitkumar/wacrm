import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { recordInboundEvent } from '@/lib/ingest/record'
import { extractMetaLeadgenChanges } from '@/lib/ingest/parse-meta'
import { sanitizeInboundHeaders } from '@/lib/ingest/headers'
import type { LeadgenWebhookPayload } from '@/lib/meta/types'

/**
 * GET /api/meta/webhook — Meta webhook verification challenge.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json({ error: 'Missing verification parameters' }, { status: 400 })
    }

    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN
    if (!expectedToken) {
      console.error('[meta/webhook] META_WEBHOOK_VERIFY_TOKEN is not set')
      return NextResponse.json({ error: 'Verify token not configured' }, { status: 500 })
    }

    if (verifyToken !== expectedToken) {
      return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 })
    }

    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err) {
    console.error('[meta/webhook] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/meta/webhook
 *
 * Persists each leadgen change as an inbound_events row synchronously,
 * then returns 200. Processing runs via /api/ingest/cron.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const admin = supabaseAdmin()
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const headers = sanitizeInboundHeaders(request.headers)

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[meta/webhook] rejected request with invalid signature')
    await recordInboundEvent(admin, {
      sourceType: 'meta_leadgen',
      sourceRef: null,
      rawBody: rawBody.slice(0, 65536),
      headers,
      ipAddress,
      authStatus: 'invalid_signature',
      status: 'rejected',
      errorMessage: 'Invalid signature',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: LeadgenWebhookPayload
  try {
    body = JSON.parse(rawBody) as LeadgenWebhookPayload
  } catch {
    await recordInboundEvent(admin, {
      sourceType: 'meta_leadgen',
      rawBody: rawBody.slice(0, 65536),
      headers,
      ipAddress,
      status: 'rejected',
      errorMessage: 'Invalid JSON',
    })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const changes = extractMetaLeadgenChanges(body)
  const eventIds: string[] = []

  if (changes.length === 0) {
    const recorded = await recordInboundEvent(admin, {
      sourceType: 'meta_leadgen',
      sourceRef: body.entry?.[0]?.id ?? null,
      rawBody,
      headers,
      ipAddress,
      status: 'skipped',
      errorMessage: 'No leadgen changes in payload',
    })
    if (recorded.eventId) eventIds.push(recorded.eventId)
    return NextResponse.json({ status: 'received', event_ids: eventIds })
  }

  for (const change of changes) {
    const recorded = await recordInboundEvent(admin, {
      sourceType: 'meta_leadgen',
      sourceRef: change.pageId,
      idempotencyKey: change.leadgenId,
      rawBody,
      headers,
      ipAddress,
      status: 'pending',
    })

    if (recorded.error) {
      console.error('[meta/webhook] failed to record event:', recorded.error)
      return NextResponse.json({ error: 'Failed to queue lead event' }, { status: 500 })
    }

    eventIds.push(recorded.eventId)
  }

  return NextResponse.json({ status: 'received', event_ids: eventIds })
}
