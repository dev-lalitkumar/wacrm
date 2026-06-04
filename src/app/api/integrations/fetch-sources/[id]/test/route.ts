import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { pollSource } from '@/lib/integrations/fetch-engine'
import type { LeadFetchSource } from '@/types'

// ============================================================
// POST /api/integrations/fetch-sources/[id]/test
//
// Admin-only dry run: renders the request (date placeholders, headers),
// calls the provider, parses the response, and returns a mapping preview
// for the first few items. Writes NOTHING — no contacts, deals, seen_refs,
// or run logs. Lets an admin validate the endpoint, items_path, ref_id
// path, mappings, and dynamic params before enabling the source.
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

  const summary = await pollSource(admin, data as LeadFetchSource, {
    dryRun: true,
    maxItems: 5,
  })
  return NextResponse.json(summary)
}
