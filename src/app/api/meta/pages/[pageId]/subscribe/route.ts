import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import {
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
  getLeadFormsWithFallback,
} from '@/lib/meta/facebook-api'
import { getFacebookUserToken, getPageAccessToken } from '@/lib/meta/page-tokens'
import { upsertLeadForms } from '@/lib/meta/sync-forms'

/**
 * POST /api/meta/pages/[pageId]/subscribe
 *
 * Subscribe a page to leadgen webhook events and fetch its lead forms.
 */
export async function POST(
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

    await subscribePageToLeadgen(pageId, pageToken)

    const { error: pageUpdateErr } = await supabase
      .from('facebook_pages')
      .update({
        is_subscribed: true,
        subscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)

    if (pageUpdateErr) {
      return NextResponse.json({ error: pageUpdateErr.message }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      forms_synced: fetchResult.forms.length,
      token_used: fetchResult.tokenUsed,
      warning: fetchResult.warning,
      graph_error: fetchResult.graphError,
      upsert_error: upsertError,
    })
  } catch (err) {
    console.error('[meta/pages/subscribe] POST error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * DELETE /api/meta/pages/[pageId]/subscribe
 *
 * Unsubscribe a page from leadgen webhook events.
 */
export async function DELETE(
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

    await unsubscribePageFromLeadgen(pageId, pageToken)

    await supabase
      .from('facebook_pages')
      .update({
        is_subscribed: false,
        subscribed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[meta/pages/subscribe] DELETE error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
