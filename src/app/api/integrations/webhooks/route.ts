import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import {
  generateSecret,
  encryptSecret,
  secretPrefix,
} from '@/lib/integrations/secret'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'
import type { WebhookFieldMappings, PipelineStage } from '@/types'

// ============================================================
// POST /api/integrations/webhooks
//
// Admin-only. Creates a new webhook with a freshly-generated secret.
// The raw secret is returned ONCE in the response body so the dialog
// can show it for copy. The DB only ever stores the encrypted form
// plus an 8-char prefix for display.
//
// Pipeline + stage are auto-resolved: every webhook uses the fixed
// pipeline and its first stage (position = 1, i.e. "New").
// ============================================================
export async function POST(request: Request) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const body = (await request.json().catch(() => null)) as {
    name?: string
    source_id?: string
    is_active?: boolean
    field_mappings?: WebhookFieldMappings
    round_robin_override?: boolean
    round_robin_member_ids?: string[]
    rate_limit_per_minute?: number
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!body.source_id) {
    return NextResponse.json({ error: 'Source is required' }, { status: 400 })
  }
  const limit = body.rate_limit_per_minute ?? 60
  if (!Number.isInteger(limit) || limit < 1) {
    return NextResponse.json(
      { error: 'rate_limit_per_minute must be a positive integer' },
      { status: 400 },
    )
  }

  // Auto-resolve the first stage of the fixed pipeline
  const admin = supabaseAdmin()
  const { data: firstStage, error: stageErr } = await admin
    .from('pipeline_stages')
    .select('id')
    .eq('pipeline_id', FIXED_PIPELINE_ID)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (stageErr || !firstStage) {
    console.error('[webhooks] failed to resolve first stage:', stageErr?.message)
    return NextResponse.json(
      { error: 'Could not resolve pipeline stage' },
      { status: 500 },
    )
  }

  const rawSecret = generateSecret()
  const encrypted = encryptSecret(rawSecret)
  const prefix = secretPrefix(rawSecret)

  const { data, error } = await admin
    .from('webhooks')
    .insert({
      name: body.name.trim(),
      source_id: body.source_id,
      is_active: body.is_active ?? true,
      creates_deal: true,
      pipeline_id: FIXED_PIPELINE_ID,
      stage_id: (firstStage as PipelineStage).id,
      field_mappings: body.field_mappings ?? {},
      round_robin_override: body.round_robin_override ?? false,
      round_robin_member_ids: body.round_robin_member_ids ?? [],
      rate_limit_per_minute: limit,
      secret_encrypted: encrypted,
      secret_prefix: prefix,
      created_by: caller.profileId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[webhooks] insert failed:', error?.message)
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, secret: rawSecret }, { status: 201 })
}
