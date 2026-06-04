import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import type {
  FetchHeader,
  FetchQueryParam,
  LeadFetchSource,
  WebhookFieldMappings,
} from '@/types'

const VALID_INTERVALS = [1, 5, 10, 20]

// ============================================================
// GET /api/integrations/fetch-sources/[id]
//
// Admin-only. Returns the source WITH decrypted headers so the edit
// form can pre-fill them. `headers_encrypted` is stripped from the
// response — the browser never sees ciphertext from this route.
// ============================================================
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller
  const { id } = await params

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('lead_fetch_sources')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Fetch source not found' }, { status: 404 })
  }

  const source = data as LeadFetchSource
  let headers: FetchHeader[] = []
  if (source.headers_encrypted) {
    try {
      const parsed = JSON.parse(decrypt(source.headers_encrypted))
      if (Array.isArray(parsed)) headers = parsed as FetchHeader[]
    } catch (err) {
      console.error('[fetch-sources] header decrypt failed:', err)
    }
  }

  const rest = { ...source }
  delete rest.headers_encrypted
  return NextResponse.json({ ...rest, headers })
}

interface PatchBody {
  name?: string
  source_id?: string
  is_active?: boolean
  creates_deal?: boolean
  endpoint_url?: string
  http_method?: 'GET' | 'POST'
  /** When present, replaces stored headers (re-encrypted). Omit to keep. */
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
// PATCH /api/integrations/fetch-sources/[id]
//
// Admin-only. Partial update. Headers are re-encrypted only when the
// `headers` array is provided.
// ============================================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller
  const { id } = await params

  const body = (await request.json().catch(() => null)) as PatchBody | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    patch.name = body.name.trim()
  }
  if (body.source_id !== undefined) patch.source_id = body.source_id
  if (body.is_active !== undefined) patch.is_active = body.is_active
  if (body.creates_deal !== undefined) patch.creates_deal = body.creates_deal
  if (body.endpoint_url !== undefined) {
    try {
      new URL(body.endpoint_url)
    } catch {
      return NextResponse.json({ error: 'Endpoint URL is not a valid URL' }, { status: 400 })
    }
    patch.endpoint_url = body.endpoint_url.trim()
  }
  if (body.http_method !== undefined) {
    if (!['GET', 'POST'].includes(body.http_method)) {
      return NextResponse.json({ error: 'http_method must be GET or POST' }, { status: 400 })
    }
    patch.http_method = body.http_method
  }
  if (body.headers !== undefined) {
    const headers = body.headers.filter((h) => h.key?.trim())
    patch.headers_encrypted = headers.length > 0 ? encrypt(JSON.stringify(headers)) : null
  }
  if (body.query_params !== undefined) patch.query_params = body.query_params
  if (body.body_template !== undefined) patch.body_template = body.body_template
  if (body.items_path !== undefined) patch.items_path = body.items_path?.trim() || null
  if (body.ref_id_path !== undefined) {
    if (!body.ref_id_path.trim()) {
      return NextResponse.json({ error: 'Ref ID path is required' }, { status: 400 })
    }
    patch.ref_id_path = body.ref_id_path.trim()
  }
  if (body.field_mappings !== undefined) patch.field_mappings = body.field_mappings
  if (body.poll_interval_minutes !== undefined) {
    if (!VALID_INTERVALS.includes(body.poll_interval_minutes)) {
      return NextResponse.json(
        { error: 'poll_interval_minutes must be one of 1, 5, 10, 20' },
        { status: 400 },
      )
    }
    patch.poll_interval_minutes = body.poll_interval_minutes
  }
  if (body.round_robin_override !== undefined) patch.round_robin_override = body.round_robin_override
  if (body.round_robin_member_ids !== undefined) {
    patch.round_robin_member_ids = body.round_robin_member_ids
  }

  const admin = supabaseAdmin()
  const { error } = await admin.from('lead_fetch_sources').update(patch).eq('id', id)
  if (error) {
    console.error('[fetch-sources] update failed:', error.message)
    return NextResponse.json({ error: 'Failed to update fetch source' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// ============================================================
// DELETE /api/integrations/fetch-sources/[id]
// Admin-only. Cascades runs + seen_refs (FK ON DELETE CASCADE).
// ============================================================
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller
  const { id } = await params

  const admin = supabaseAdmin()
  const { error } = await admin.from('lead_fetch_sources').delete().eq('id', id)
  if (error) {
    console.error('[fetch-sources] delete failed:', error.message)
    return NextResponse.json({ error: 'Failed to delete fetch source' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
