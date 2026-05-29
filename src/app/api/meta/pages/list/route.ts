import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

/**
 * GET /api/meta/pages/list
 *
 * Returns pages stored in the DB (no Graph API call).
 */
export async function GET() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const supabase = await createClient()
    const { data: pages, error } = await supabase
      .from('facebook_pages')
      .select('id, name, category, picture_url, is_subscribed, subscribed_at, created_at, updated_at')
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ pages: pages ?? [] })
  } catch (err) {
    console.error('[meta/pages/list] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
