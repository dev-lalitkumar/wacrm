import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { encrypt } from '@/lib/whatsapp/encryption'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'
import type {
  FetchHeader,
  FetchQueryParam,
  PipelineStage,
  WebhookFieldMappings,
} from '@/types'

const VALID_INTERVALS = [1, 5, 10, 20]

interface CreateBody {
  name?: string
  source_id?: string
  is_active?: boolean
  creates_deal?: boolean
  endpoint_url?: string
  http_method?: 'GET' | 'POST'
  headers?: FetchHeader[]
  query_params?: FetchQueryParam[]
  body_template?: Record<string, unknown> | null
  items_path?: string | null
  ref_id_path?: string
  field_mappings?: WebhookFieldMappings
  poll_interval_minutes?: number
  round_robin_override?: boolean
  round_robin_member_ids?: string[]
}

// ============================================================
// POST /api/integrations/fetch-sources
//
// Admin-only. Creates a pull-based lead fetch source. Headers are
// encrypted at rest (they may carry bearer tokens / API keys). The
// pipeline + first stage are auto-resolved like webhooks. The source
// is scheduled to run immediately (next_poll_at = now).
// ============================================================
export async function POST(request: Request) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const body = (await request.json().catch(() => null)) as CreateBody | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const err = validateCore(body)
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const admin = supabaseAdmin()

  // Auto-resolve the first stage of the fixed pipeline (mirrors webhooks).
  const { data: firstStage, error: stageErr } = await admin
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', FIXED_PIPELINE_ID)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (stageErr || !firstStage) {
    console.error('[fetch-sources] failed to resolve first stage:', stageErr?.message)
    return NextResponse.json({ error: 'Could not resolve pipeline stage' }, { status: 500 })
  }

  const headers = (body.headers ?? []).filter((h) => h.key?.trim())
  const headersEncrypted = headers.length > 0 ? encrypt(JSON.stringify(headers)) : null

  const { data, error } = await admin
    .from('lead_fetch_sources')
    .insert({
      name: body.name!.trim(),
      source_id: body.source_id,
      is_active: body.is_active ?? true,
      creates_deal: body.creates_deal ?? true,
      pipeline_id: FIXED_PIPELINE_ID,
      stage_id: (firstStage as PipelineStage).id,
      endpoint_url: body.endpoint_url!.trim(),
      http_method: body.http_method ?? 'GET',
      headers_encrypted: headersEncrypted,
      query_params: body.query_params ?? [],
      body_template: body.body_template ?? null,
      items_path: body.items_path?.trim() || null,
      ref_id_path: body.ref_id_path!.trim(),
      field_mappings: body.field_mappings ?? {},
      poll_interval_minutes: body.poll_interval_minutes,
      next_poll_at: new Date().toISOString(),
      last_status: 'idle',
      round_robin_override: body.round_robin_override ?? false,
      round_robin_member_ids: body.round_robin_member_ids ?? [],
      created_by: caller.profileId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[fetch-sources] insert failed:', error?.message)
    return NextResponse.json({ error: 'Failed to create fetch source' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

/** Shared required-field validation for create. Returns an error string or null. */
function validateCore(body: CreateBody): string | null {
  if (!body.name?.trim()) return 'Name is required'
  if (!body.source_id) return 'Source is required'
  if (!body.endpoint_url?.trim()) return 'Endpoint URL is required'
  try {
    new URL(body.endpoint_url)
  } catch {
    return 'Endpoint URL is not a valid URL'
  }
  if (body.http_method && !['GET', 'POST'].includes(body.http_method)) {
    return 'http_method must be GET or POST'
  }
  if (!body.ref_id_path?.trim()) return 'Ref ID path is required'
  if (!VALID_INTERVALS.includes(body.poll_interval_minutes as number)) {
    return 'poll_interval_minutes must be one of 1, 5, 10, 20'
  }
  return null
}
