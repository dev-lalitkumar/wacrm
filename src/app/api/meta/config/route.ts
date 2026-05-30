import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { decrypt } from '@/lib/encryption'
import { unsubscribePageFromLeadgen } from '@/lib/meta/facebook-api'

/**
 * GET /api/meta/config
 *
 * Returns Facebook connection status. Any authenticated user may call
 * this. Never exposes tokens.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET)

    // Use admin client — facebook_config is org-wide singleton; session
    // client RLS can silently return null in some request contexts.
    const admin = supabaseAdmin()

    const { data: config, error: configErr } = await admin
      .from('facebook_config')
      .select('status, fb_user_name, fb_user_email, fb_user_picture, token_expires_at, connected_at')
      .eq('id', 1)
      .maybeSingle()

    if (configErr) {
      console.error('[meta/config] GET db error:', configErr.message)
    }

    const { count: pageCount } = await admin
      .from('facebook_pages')
      .select('id', { count: 'exact', head: true })

    if (!config || config.status !== 'connected') {
      return NextResponse.json({
        connected: false,
        configured,
        status: config?.status ?? 'disconnected',
        fb_user_name: null,
        fb_user_email: null,
        fb_user_picture: null,
        token_expires_at: null,
        page_count: 0,
      })
    }

    return NextResponse.json({
      connected: true,
      configured,
      status: 'connected',
      fb_user_name: config.fb_user_name,
      fb_user_email: config.fb_user_email,
      fb_user_picture: config.fb_user_picture ?? null,
      token_expires_at: config.token_expires_at,
      connected_at: config.connected_at,
      page_count: pageCount ?? 0,
    })
  } catch (err) {
    console.error('[meta/config] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/meta/config
 *
 * Full disconnect:
 *   1. Unsubscribe all subscribed pages from Meta leadgen webhook
 *   2. Delete all pages / forms / mappings from DB (cascade)
 *   3. Clear facebook_config → status = 'disconnected'
 *
 * Admin/Owner only.
 */
export async function DELETE() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const admin = supabaseAdmin()

    // ── 1. Unsubscribe pages from Meta API ────────────────────
    const { data: subscribedPages } = await admin
      .from('facebook_pages')
      .select('id, access_token')
      .eq('is_subscribed', true)

    if (subscribedPages && subscribedPages.length > 0) {
      const unsubscribeResults = await Promise.allSettled(
        subscribedPages.map(async (page) => {
          try {
            const pageToken = decrypt(page.access_token)
            await unsubscribePageFromLeadgen(page.id, pageToken)
            console.log(`[meta/config] Unsubscribed page ${page.id} from leadgen`)
          } catch (err) {
            // Log but don't block — page may have already been removed
            // from the app or the token may be expired.
            console.warn(`[meta/config] Could not unsubscribe page ${page.id}:`, err)
          }
        }),
      )
      const failed = unsubscribeResults.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        console.warn(`[meta/config] ${failed}/${subscribedPages.length} pages could not be unsubscribed from Meta (continuing with DB cleanup)`)
      }
    }

    // ── 2. Delete pages (cascade → forms + mappings) ─────────
    const { error: pagesErr } = await admin
      .from('facebook_pages')
      .delete()
      .neq('id', '')

    if (pagesErr) {
      console.error('[meta/config] DELETE pages error:', pagesErr.message)
      // Non-fatal — continue to clear config
    }

    // ── 3. Reset facebook_config to disconnected ─────────────
    const { error: configErr } = await admin
      .from('facebook_config')
      .upsert({
        id: 1,
        user_token: null,
        fb_user_id: null,
        fb_user_name: null,
        fb_user_email: null,
        fb_user_picture: null,
        token_expires_at: null,
        status: 'disconnected',
        connected_at: null,
        connected_by: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (configErr) {
      console.error('[meta/config] DELETE config error:', configErr.message)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[meta/config] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
