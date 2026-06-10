export type InboundSourceType = 'meta_leadgen' | 'integration_webhook' | 'public_form'

export type InboundEventStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'skipped'
  | 'rejected'

export type InboundAuthStatus =
  | 'ok'
  | 'invalid_signature'
  | 'invalid_secret'
  | 'rate_limited'
  | 'disabled'

export interface InboundEventResult {
  contact_id?: string | null
  deal_id?: string | null
  leadgen_id?: string | null
  page_id?: string | null
  form_id?: string | null
  deduplicated?: boolean
  is_new_contact?: boolean
}

export interface InboundEvent {
  id: string
  source_type: InboundSourceType
  source_ref: string | null
  idempotency_key: string | null
  status: InboundEventStatus
  auth_status: InboundAuthStatus
  raw_body: string
  headers: Record<string, unknown>
  ip_address: string | null
  received_at: string
  processed_at: string | null
  attempt_count: number
  max_attempts: number
  next_attempt_at: string
  error_message: string | null
  result: InboundEventResult
  claimed_by: string | null
  claimed_at: string | null
}

export interface RecordInboundEventInput {
  sourceType: InboundSourceType
  sourceRef?: string | null
  idempotencyKey?: string | null
  rawBody: string
  headers?: Record<string, string>
  ipAddress?: string | null
  authStatus?: InboundAuthStatus
  status?: InboundEventStatus
  errorMessage?: string | null
}

export interface RecordInboundEventResult {
  eventId: string
  duplicate?: boolean
  error?: string
}
