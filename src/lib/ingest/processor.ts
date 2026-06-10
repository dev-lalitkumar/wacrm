import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import type { InboundEvent, InboundEventStatus } from './types'
import { processMetaLeadgenEvent } from './meta-processor'
import { processIntegrationWebhookEvent } from './integration-processor'
import { processPublicFormEvent } from './form-processor'

const MAX_ATTEMPTS = 5

function backoffSeconds(attemptCount: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1))
}

type ProcessorOutcomeStatus = InboundEventStatus | 'error'

function toInboundStatus(status: ProcessorOutcomeStatus): InboundEventStatus {
  return status === 'error' ? 'failed' : status
}

async function finalizeEvent(
  admin: SupabaseClient,
  eventId: string,
  event: InboundEvent,
  outcome: {
    status: ProcessorOutcomeStatus
    errorMessage?: string
    result?: InboundEvent['result']
  },
) {
  const status = toInboundStatus(outcome.status)
  const now = new Date().toISOString()
  const terminal = ['success', 'skipped', 'rejected'].includes(status)

  if (terminal) {
    await admin
      .from('inbound_events')
      .update({
        status,
        processed_at: now,
        error_message: outcome.errorMessage ?? null,
        result: outcome.result ?? {},
        next_attempt_at: now,
        claimed_by: null,
        claimed_at: null,
      })
      .eq('id', eventId)
    return
  }

  const exhausted = event.attempt_count >= event.max_attempts
  if (exhausted) {
    await admin
      .from('inbound_events')
      .update({
        status: 'failed',
        processed_at: now,
        error_message: outcome.errorMessage ?? null,
        result: outcome.result ?? {},
        next_attempt_at: now,
        claimed_by: null,
        claimed_at: null,
      })
      .eq('id', eventId)
    return
  }

  const nextAttemptAt = new Date(
    Date.now() + backoffSeconds(event.attempt_count) * 1000,
  ).toISOString()

  await admin
    .from('inbound_events')
    .update({
      status: 'failed',
      processed_at: null,
      error_message: outcome.errorMessage ?? null,
      result: outcome.result ?? {},
      next_attempt_at: nextAttemptAt,
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', eventId)
}

export async function processInboundEvent(
  eventId: string,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<{ ok: boolean; status: string }> {
  const { data: row, error } = await admin
    .from('inbound_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, status: 'not_found' }
  }

  const event = row as InboundEvent

  if (['success', 'skipped', 'rejected'].includes(event.status)) {
    return { ok: true, status: event.status }
  }

  try {
    if (event.source_type === 'meta_leadgen') {
      const outcome = await processMetaLeadgenEvent(admin, event)
      await finalizeEvent(admin, eventId, event, {
        status: outcome.status,
        errorMessage: outcome.errorMessage,
        result: outcome.result,
      })
      return { ok: outcome.status === 'success', status: outcome.status }
    }

    if (event.source_type === 'integration_webhook') {
      const outcome = await processIntegrationWebhookEvent(admin, event)
      await finalizeEvent(admin, eventId, event, {
        status: outcome.status,
        errorMessage: outcome.errorMessage,
        result: outcome.result,
      })
      return { ok: outcome.status === 'success', status: outcome.status }
    }

    if (event.source_type === 'public_form') {
      const outcome = await processPublicFormEvent(admin, event)
      await finalizeEvent(admin, eventId, event, {
        status: outcome.status,
        errorMessage: outcome.errorMessage,
        result: outcome.result,
      })
      return { ok: outcome.status === 'success', status: outcome.status }
    }

    await finalizeEvent(admin, eventId, event, {
      status: 'error',
      errorMessage: `Unknown source_type: ${event.source_type}`,
    })
    return { ok: false, status: 'error' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await finalizeEvent(admin, eventId, event, {
      status: 'error',
      errorMessage: msg,
    })
    return { ok: false, status: 'error' }
  }
}

export async function drainInboundEvents(
  batchSize: number,
  workerId: string,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<{ claimed: number; processed: number; results: Array<{ id: string; status: string }> }> {
  const { data: claimed, error } = await admin.rpc('claim_inbound_events', {
    p_batch_size: batchSize,
    p_worker_id: workerId,
  })

  if (error) {
    console.error('[ingest/drain] claim failed:', error.message)
    return { claimed: 0, processed: 0, results: [] }
  }

  const events = (claimed ?? []) as InboundEvent[]
  const results: Array<{ id: string; status: string }> = []

  for (const event of events) {
    const res = await processInboundEvent(event.id, admin)
    results.push({ id: event.id, status: res.status })
  }

  return {
    claimed: events.length,
    processed: results.filter((r) => r.status === 'success').length,
    results,
  }
}

export async function requeueInboundEvent(
  eventId: string,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { error } = await admin
    .from('inbound_events')
    .update({
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
      error_message: null,
      claimed_by: null,
      claimed_at: null,
    })
    .eq('id', eventId)
    .in('status', ['failed', 'skipped'])

  return !error
}
