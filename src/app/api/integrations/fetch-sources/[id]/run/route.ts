import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { pollSource } from '@/lib/integrations/fetch-engine'
import type { LeadFetchSource } from '@/types'

// ============================================================
// POST /api/integrations/fetch-sources/[id]/run
//
// Admin-only "Run now". Executes one real poll immediately (creates
// contacts/deals, records seen_refs + a run log, advances scheduling).
// ============================================================
export async function POST(
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

  const summary = await pollSource(admin, data as LeadFetchSource)
  return NextResponse.json(summary)
}
