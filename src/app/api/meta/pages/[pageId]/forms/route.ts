import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { decrypt } from '@/lib/encryption'
import { getLeadForms } from '@/lib/meta/facebook-api'

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

    const { data: pageRow } = await supabase
      .from('facebook_pages')
      .select('access_token')
      .eq('id', pageId)
      .maybeSingle()

    if (!pageRow?.access_token) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const pageToken = decrypt(pageRow.access_token)
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

    // Fetch with mapping counts
    const { data: dbForms } = await supabase
      .from('facebook_lead_forms')
      .select('*, facebook_field_mappings(count)')
      .eq('page_id', pageId)
      .order('name')

    return NextResponse.json({ forms: dbForms ?? [] })
  } catch (err) {
    console.error('[meta/pages/forms] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
