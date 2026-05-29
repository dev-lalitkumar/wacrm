import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { decrypt } from '@/lib/encryption'
import {
  subscribePageToLeadgen,
  unsubscribePageFromLeadgen,
  getLeadForms,
} from '@/lib/meta/facebook-api'

async function getPageToken(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  pageId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('facebook_pages')
    .select('access_token')
    .eq('id', pageId)
    .maybeSingle()
  if (!data?.access_token) return null
  return decrypt(data.access_token)
}

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

    const pageToken = await getPageToken(supabase, pageId)
    if (!pageToken) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    await subscribePageToLeadgen(pageId, pageToken)

    await supabase
      .from('facebook_pages')
      .update({ is_subscribed: true, subscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', pageId)

    // Fetch and upsert lead forms for this page
    const forms = await getLeadForms(pageId, pageToken)
    if (forms.length > 0) {
      const formRows = forms.map((f) => ({
        id: f.id,
        page_id: pageId,
        name: f.name,
        questions: (f.questions ?? []).map((q) => ({
          key: q.key,
          label: q.label,
          type: q.type,
        })),
        updated_at: new Date().toISOString(),
      }))
      await supabase
        .from('facebook_lead_forms')
        .upsert(formRows, { onConflict: 'id', ignoreDuplicates: false })
    }

    return NextResponse.json({ success: true, forms_synced: forms.length })
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

    const pageToken = await getPageToken(supabase, pageId)
    if (!pageToken) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    await unsubscribePageFromLeadgen(pageId, pageToken)

    await supabase
      .from('facebook_pages')
      .update({ is_subscribed: false, subscribed_at: null, updated_at: new Date().toISOString() })
      .eq('id', pageId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[meta/pages/subscribe] DELETE error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
