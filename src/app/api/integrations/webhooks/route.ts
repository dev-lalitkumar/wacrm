import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import {
  generateSecret,
  encryptSecret,
  secretPrefix,
} from '@/lib/integrations/secret'
import type { WebhookFieldMappings } from '@/types'

// ============================================================
// POST /api/integrations/webhooks
//
// Admin-only. Creates a new webhook with a freshly-generated secret.
// The raw secret is returned ONCE in the response body so the dialog
// can show it for copy. The DB only ever stores the encrypted form
// plus an 8-char prefix for display.
// ============================================================
export async function POST(request: Request) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const body = (await request.json().catch(() => null)) as {
    name?: string
    source_id?: string
    is_active?: boolean
    creates_deal?: boolean
    pipeline_id?: string | null
    stage_id?: string | null
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
  if (body.creates_deal && (!body.pipeline_id || !body.stage_id)) {
    return NextResponse.json(
      { error: 'Pipeline and stage are required when creating deals' },
      { status: 400 },
    )
  }
  const limit = body.rate_limit_per_minute ?? 60
  if (!Number.isInteger(limit) || limit < 1) {
    return NextResponse.json(
      { error: 'rate_limit_per_minute must be a positive integer' },
      { status: 400 },
    )
  }

  const rawSecret = generateSecret()
  const encrypted = encryptSecret(rawSecret)
  const prefix = secretPrefix(rawSecret)

  const { data, error } = await supabaseAdmin()
    .from('webhooks')
    .insert({
      name: body.name.trim(),
      source_id: body.source_id,
      is_active: body.is_active ?? true,
      creates_deal: body.creates_deal ?? false,
      pipeline_id: body.creates_deal ? body.pipeline_id : null,
      stage_id: body.creates_deal ? body.stage_id : null,
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
