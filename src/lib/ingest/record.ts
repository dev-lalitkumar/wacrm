import type { SupabaseClient } from '@supabase/supabase-js'
import { sanitizeInboundHeaders } from './headers'
import type {
  RecordInboundEventInput,
  RecordInboundEventResult,
  InboundSourceType,
} from './types'

export async function recordInboundEvent(
  admin: SupabaseClient,
  input: RecordInboundEventInput,
): Promise<RecordInboundEventResult> {
  const {
    sourceType,
    sourceRef = null,
    idempotencyKey = null,
    rawBody,
    headers = {},
    ipAddress = null,
    authStatus = 'ok',
    status = 'pending',
    errorMessage = null,
  } = input

  if (idempotencyKey && status === 'pending') {
    const { data: existingSuccess } = await admin
      .from('inbound_events')
      .select('id')
      .eq('source_type', sourceType)
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'success')
      .maybeSingle()

    if (existingSuccess) {
      return { eventId: existingSuccess.id, duplicate: true }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentPending } = await admin
      .from('inbound_events')
      .select('id')
      .eq('source_type', sourceType)
      .eq('idempotency_key', idempotencyKey)
      .in('status', ['pending', 'processing'])
      .gte('received_at', since)
      .maybeSingle()

    if (recentPending) {
      return { eventId: recentPending.id, duplicate: true }
    }
  }

  const { data, error } = await admin
    .from('inbound_events')
    .insert({
      source_type: sourceType,
      source_ref: sourceRef,
      idempotency_key: idempotencyKey,
      status,
      auth_status: authStatus,
      raw_body: rawBody,
      headers: sanitizeInboundHeaders(headers),
      ip_address: ipAddress,
      error_message: errorMessage,
      next_attempt_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) {
    if (idempotencyKey && error?.code === '23505') {
      const { data: raced } = await admin
        .from('inbound_events')
        .select('id')
        .eq('source_type', sourceType)
        .eq('idempotency_key', idempotencyKey)
        .eq('status', 'success')
        .maybeSingle()
      if (raced) return { eventId: raced.id, duplicate: true }
    }
    return { eventId: '', error: error?.message ?? 'insert failed' }
  }

  return { eventId: data.id as string }
}

export async function findDuplicateIntegrationEvent(
  admin: SupabaseClient,
  sourceType: InboundSourceType,
  idempotencyKey: string,
): Promise<string | null> {
  const { data } = await admin
    .from('inbound_events')
    .select('id')
    .eq('source_type', sourceType)
    .eq('idempotency_key', idempotencyKey)
    .eq('status', 'success')
    .maybeSingle()
  return data?.id ?? null
}
