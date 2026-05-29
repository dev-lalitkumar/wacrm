import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

/**
 * GET /api/telephony/call-logs
 *
 * Returns paginated call logs.
 * Query params: contact_id, deal_id, limit (default 20), offset (default 0)
 * Admin/Owner/Manager only.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner', 'manager'])
    if (isErrorResponse(caller)) return caller

    const sp = req.nextUrl.searchParams
    const contactId = sp.get('contact_id')
    const dealId = sp.get('deal_id')
    const limit = Math.min(Number(sp.get('limit') ?? 20), 100)
    const offset = Number(sp.get('offset') ?? 0)

    const supabase = await createClient()

    let query = supabase
      .from('telephony_call_logs')
      .select(
        `id, provider_call_id, status, from_number, to_number,
         duration, recording_url, started_at, ended_at, created_at,
         agent:profiles!initiated_by(full_name, email),
         provider:telephony_providers(name, provider_key)`,
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (contactId) query = query.eq('contact_id', contactId)
    if (dealId) query = query.eq('deal_id', dealId)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: data ?? [] })
  } catch (err) {
    console.error('[telephony/call-logs] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
