import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { decrypt } from '@/lib/encryption'
import { fetchLeadData } from '@/lib/meta/facebook-api'
import { processLeadEvent } from '@/lib/meta/lead-processor'
import type { LeadgenWebhookPayload } from '@/lib/meta/types'

const FB_LEADS_SOURCE_NAME = 'Facebook Leads'

/**
 * GET /api/meta/webhook
 *
 * Meta webhook verification challenge.
 * Compares hub.verify_token against META_WEBHOOK_VERIFY_TOKEN env var.
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
 * Receives Meta leadgen webhook events.
 * Verifies HMAC-SHA256 signature, returns 200 immediately,
 * then processes leads asynchronously.
 */
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    console.warn('[meta/webhook] rejected request with invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: LeadgenWebhookPayload
  try {
    body = JSON.parse(rawBody) as LeadgenWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ack immediately — Meta requires a fast 200 response
  processLeadgenWebhook(body, rawBody).catch((err) => {
    console.error('[meta/webhook] processing error:', err)
  })

  return NextResponse.json({ status: 'received' })
}

async function processLeadgenWebhook(
  body: LeadgenWebhookPayload,
  rawBody: string,
) {
  if (!body.entry?.length) return

  const admin = supabaseAdmin()

  // Find or create the "Facebook Leads" source
  const sourceId = await getOrCreateFacebookLeadsSource(admin)
  if (!sourceId) {
    console.error('[meta/webhook] could not resolve Facebook Leads source')
    return
  }

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'leadgen') continue

      const { leadgen_id, page_id, form_id } = change.value
      if (!leadgen_id || !page_id || !form_id) continue

      await processOneLead({
        admin,
        leadgenId: leadgen_id,
        pageId: page_id,
        formId: form_id,
        sourceId,
        rawPayload: rawBody,
      })
    }
  }
}

async function processOneLead({
  admin,
  leadgenId,
  pageId,
  formId,
  sourceId,
  rawPayload,
}: {
  admin: ReturnType<typeof supabaseAdmin>
  leadgenId: string
  pageId: string
  formId: string
  sourceId: string
  rawPayload: string
}) {
  // Check for duplicate — Meta can replay events
  const { data: existing } = await admin
    .from('meta_webhook_logs')
    .select('id')
    .eq('leadgen_id', leadgenId)
    .eq('status', 'success')
    .maybeSingle()

  if (existing) return // already processed

  // Fetch page access token
  const { data: pageRow } = await admin
    .from('facebook_pages')
    .select('access_token')
    .eq('id', pageId)
    .maybeSingle()

  if (!pageRow?.access_token) {
    await logEvent(admin, { leadgenId, pageId, formId, status: 'skipped', errorMessage: 'Page not found or not connected', rawPayload })
    return
  }

  let pageToken: string
  try {
    pageToken = decrypt(pageRow.access_token)
  } catch {
    await logEvent(admin, { leadgenId, pageId, formId, status: 'error', errorMessage: 'Failed to decrypt page token', rawPayload })
    return
  }

  // Fetch lead data from Meta
  let leadData: Awaited<ReturnType<typeof fetchLeadData>>
  try {
    leadData = await fetchLeadData(leadgenId, pageToken)
  } catch (err) {
    await logEvent(admin, { leadgenId, pageId, formId, status: 'error', errorMessage: `fetchLeadData failed: ${err}`, rawPayload })
    return
  }

  // Process through central lead save path
  const result = await processLeadEvent(admin, {
    leadgenId,
    pageId,
    formId: leadData.form_id ?? formId,
    fieldData: leadData.field_data ?? [],
    sourceId,
  })

  await logEvent(admin, {
    leadgenId,
    pageId,
    formId: leadData.form_id ?? formId,
    status: result.status,
    contactId: result.contactId ?? undefined,
    dealId: result.dealId ?? undefined,
    errorMessage: result.errorMessage,
    rawPayload,
  })
}

async function getOrCreateFacebookLeadsSource(
  admin: ReturnType<typeof supabaseAdmin>,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('sources')
    .select('id')
    .eq('name', FB_LEADS_SOURCE_NAME)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await admin
    .from('sources')
    .insert({ name: FB_LEADS_SOURCE_NAME, color: '#1877F2' })
    .select('id')
    .single()

  if (error) {
    console.error('[meta/webhook] failed to create source:', error.message)
    return null
  }
  return created.id
}

async function logEvent(
  admin: ReturnType<typeof supabaseAdmin>,
  opts: {
    leadgenId: string
    pageId?: string
    formId?: string
    status: 'success' | 'error' | 'skipped'
    contactId?: string
    dealId?: string
    errorMessage?: string
    rawPayload?: string
  },
) {
  try {
    await admin.from('meta_webhook_logs').insert({
      leadgen_id: opts.leadgenId,
      page_id: opts.pageId ?? null,
      form_id: opts.formId ?? null,
      status: opts.status,
      contact_id: opts.contactId ?? null,
      deal_id: opts.dealId ?? null,
      error_message: opts.errorMessage ?? null,
      raw_payload: opts.rawPayload ? JSON.parse(opts.rawPayload) : null,
    })
  } catch (err) {
    console.error('[meta/webhook] failed to log event:', err)
  }
}
