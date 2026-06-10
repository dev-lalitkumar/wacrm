import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getLeadFormsWithFallback } from '@/lib/meta/facebook-api'
import { getFacebookUserToken, getPageAccessToken } from '@/lib/meta/page-tokens'
import { upsertLeadForms } from '@/lib/meta/sync-forms'

/**
 * GET /api/meta/pages/[pageId]/forms
 *
 * Re-fetch and upsert lead forms for a page. Returns forms with
 * their current mapping count.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const { pageId } = await params
    const supabase = await createClient()

    const pageToken = await getPageAccessToken(supabase, pageId)
    if (!pageToken) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const userToken = await getFacebookUserToken(supabase)
    const fetchResult = await getLeadFormsWithFallback(pageId, pageToken, userToken)

    let upsertError: string | undefined
    if (fetchResult.forms.length > 0) {
      const upsert = await upsertLeadForms(supabase, pageId, fetchResult.forms)
      if (upsert.error) {
        upsertError = upsert.error
      }
    }

    const { data: dbForms, error: dbErr } = await supabase
      .from('facebook_lead_forms')
      .select('*, facebook_field_mappings(count)')
      .eq('page_id', pageId)
      .order('name')

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({
      forms: dbForms ?? [],
      synced_count: fetchResult.forms.length,
      token_used: fetchResult.tokenUsed,
      warning: fetchResult.warning,
      graph_error: fetchResult.graphError,
      upsert_error: upsertError,
    })
  } catch (err) {
    console.error('[meta/pages/forms] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
