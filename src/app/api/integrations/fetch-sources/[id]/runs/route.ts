import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import type { LeadFetchRun } from '@/types'

// ============================================================
// GET /api/integrations/fetch-sources/[id]/runs
//
// Admin/Owner/Manager. Recent poll run logs for a source (newest first).
// ============================================================
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(caller)) return caller
  const { id } = await params

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('lead_fetch_runs')
    .select('*')
    .eq('fetch_source_id', id)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ runs: (data ?? []) as LeadFetchRun[] })
}
