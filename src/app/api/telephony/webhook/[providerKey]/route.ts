import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { PROVIDER_TEMPLATES, resolveWebhookField, mapCallStatus } from '@/lib/telephony/providers'
import { decrypt } from '@/lib/encryption'
import { phonesMatch } from '@/lib/whatsapp/phone-utils'

/**
 * POST /api/telephony/webhook/[providerKey]
 *
 * Public endpoint — receives call completion events from telephony providers.
 * providerKey matches telephony_providers.webhook_identifier.
 *
 * On completion:
 *   1. Updates telephony_call_logs with status, duration, recording_url
 *   2. Auto-inserts a single followup (channel='call') with call metadata
 *      and optional deal_id when known
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const { providerKey } = await params

  // Immediately ack — providers expect fast 200
  const rawBody = await req.text()
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process asynchronously
  processWebhook(providerKey, payload).catch((err) => {
    console.error('[telephony/webhook] processing error:', err)
  })

  return NextResponse.json({ status: 'received' })
}

async function processWebhook(providerKey: string, payload: Record<string, unknown>) {
  const admin = supabaseAdmin()

  // Find provider by webhook_identifier
  const { data: providerRow } = await admin
    .from('telephony_providers')
    .select('id, provider_key, is_active')
    .eq('webhook_identifier', providerKey)
    .maybeSingle()

  if (!providerRow?.is_active) {
    console.warn(`[telephony/webhook] unknown or inactive provider key: ${providerKey}`)
    return
  }

  const tpl = PROVIDER_TEMPLATES[providerRow.provider_key]
  if (!tpl) return

  // Extract fields from payload using provider mapping
  const mapping = tpl.webhookMapping

  const providerCallId = resolveWebhookField(payload, mapping.providerCallIdPath)
  const rawStatus = resolveWebhookField(payload, mapping.statusPath)
  const durationRaw = resolveWebhookField(payload, mapping.durationPath)
  const recordingUrl = resolveWebhookField(payload, mapping.recordingUrlPath) || null
  const toNumber = resolveWebhookField(payload, mapping.toNumberPath) || null
  const fromNumber = resolveWebhookField(payload, mapping.fromNumberPath) || null

  const callStatus = mapCallStatus(rawStatus, tpl.statusMapping)
  const duration = durationRaw ? Math.round(Number(durationRaw)) || null : null

  // Find existing call log
  let logId: string | null = null
  let contactId: string | null = null
  let dealId: string | null = null
  let initiatedBy: string | null = null
  let resolvedToNumber = toNumber

  if (providerCallId) {
    const { data: logRow } = await admin
      .from('telephony_call_logs')
      .select('id, contact_id, deal_id, initiated_by, to_number')
      .eq('provider_call_id', providerCallId)
      .maybeSingle()

    if (logRow) {
      logId = logRow.id
      contactId = logRow.contact_id
      dealId = logRow.deal_id
      initiatedBy = logRow.initiated_by
      resolvedToNumber = resolvedToNumber ?? logRow.to_number
    }
  }

  // Sanitize payload before storing (strip apiKey from URLs)
  const sanitized = sanitizePayload(payload)

  if (logId) {
    // Update existing log
    await admin
      .from('telephony_call_logs')
      .update({
        status: callStatus,
        duration,
        recording_url: recordingUrl,
        to_number: resolvedToNumber ?? undefined,
        from_number: fromNumber ?? undefined,
        webhook_payload: sanitized,
        ended_at: new Date().toISOString(),
      })
      .eq('id', logId)
  } else {
    // Orphan webhook — create a log for audit
    const { data: newLog } = await admin
      .from('telephony_call_logs')
      .insert({
        provider_call_id: providerCallId,
        provider_id: providerRow.id,
        status: callStatus,
        duration,
        recording_url: recordingUrl,
        to_number: resolvedToNumber,
        from_number: fromNumber,
        webhook_payload: sanitized,
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    logId = newLog?.id ?? null
    console.warn(`[telephony/webhook] orphan webhook for callId=${providerCallId}`)
  }

  // Resolve contact by phone if not linked
  if (!contactId && resolvedToNumber) {
    const { data: allContacts } = await admin
      .from('contacts')
      .select('id, phone')

    const normalizedTarget = normalizePhone(resolvedToNumber)
    const match = (allContacts ?? []).find(
      (c) => c.phone && phonesMatch(c.phone, normalizedTarget),
    )
    if (match) {
      contactId = match.id
      if (logId) {
        await admin
          .from('telephony_call_logs')
          .update({ contact_id: contactId })
          .eq('id', logId)
      }
    }
  }

  // Auto-create a single followup entry for terminal statuses
  const isTerminal = ['completed', 'no_answer', 'busy', 'failed', 'canceled'].includes(callStatus)
  if (!isTerminal || !logId || !contactId) return

  const note = buildCallNote(callStatus, duration, recordingUrl)

  const row: Record<string, unknown> = {
    contact_id: contactId,
    channel: 'call',
    note,
    created_by: initiatedBy ?? undefined,
    call_log_id: logId,
    recording_url: recordingUrl,
    call_duration: duration,
  }
  if (dealId) row.deal_id = dealId

  const { error: fuErr } = await admin.from('followups').insert(row)
  if (fuErr) {
    console.error('[telephony/webhook] followup insert error:', fuErr.message)
  }
}

function buildCallNote(status: string, duration: number | null, recordingUrl: string | null): string {
  const statusLabel: Record<string, string> = {
    completed: 'Answered',
    no_answer: 'No Answer',
    busy: 'Busy',
    failed: 'Failed',
    canceled: 'Canceled',
  }
  const label = statusLabel[status] ?? status
  const dur = duration != null ? ` · ${formatDuration(duration)}` : ''
  const rec = recordingUrl ? ' · Recording available' : ''
  return `Outbound call${dur} · ${label}${rec}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  if (digits.length > 10) return digits.slice(-10)
  return digits
}

function sanitizePayload(obj: unknown): unknown {
  try {
    const clone = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
    if (clone.apiKey) clone.apiKey = '***'
    return clone
  } catch {
    return {}
  }
}
