import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { decrypt, encrypt } from '@/lib/encryption'
import { getPages, getFacebookUserInfo } from '@/lib/meta/facebook-api'

/**
 * POST /api/meta/pages/sync
 *
 * Re-fetches the admin's Facebook pages and upserts them.
 * Also refreshes the stored profile picture.
 * Admin/Owner only.
 */
export async function POST() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    // Use admin client to read config (bypasses RLS on singleton)
    const admin = supabaseAdmin()
    const supabase = await createClient()

    const { data: config } = await admin
      .from('facebook_config')
      .select('user_token, status, fb_user_picture')
      .eq('id', 1)
      .maybeSingle()

    if (!config?.user_token || config.status !== 'connected') {
      return NextResponse.json(
        { error: 'Facebook account not connected' },
        { status: 400 },
      )
    }

    const longToken = decrypt(config.user_token)

    // Refresh profile picture if missing
    if (!config.fb_user_picture) {
      try {
        const fbUser = await getFacebookUserInfo(longToken)
        if (fbUser.picture?.data?.url) {
          await admin
            .from('facebook_config')
            .update({ fb_user_picture: fbUser.picture.data.url, updated_at: new Date().toISOString() })
            .eq('id', 1)
        }
      } catch {
        // Non-fatal
      }
    }

    const pages = await getPages(longToken)

    if (pages.length > 0) {
      const pageRows = pages.map((p) => ({
        id: p.id,
        name: p.name,
        access_token: encrypt(p.access_token),
        category: p.category ?? null,
        picture_url: p.picture?.data?.url ?? null,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('facebook_pages')
        .upsert(pageRows, { onConflict: 'id', ignoreDuplicates: false })

      if (error) {
        console.error('[meta/pages/sync] upsert error:', error)
        return NextResponse.json({ error: 'Failed to sync pages' }, { status: 500 })
      }
    }

    const { data: updatedPages } = await supabase
      .from('facebook_pages')
      .select('*')
      .order('name')

    return NextResponse.json({ pages: updatedPages ?? [] })
  } catch (err) {
    console.error('[meta/pages/sync] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
