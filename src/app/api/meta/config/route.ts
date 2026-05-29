import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

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

    const { data: config } = await supabase
      .from('facebook_config')
      .select('status, fb_user_name, fb_user_email, token_expires_at, connected_at')
      .eq('id', 1)
      .maybeSingle()

    const { count: pageCount } = await supabase
      .from('facebook_pages')
      .select('id', { count: 'exact', head: true })

    if (!config || config.status !== 'connected') {
      return NextResponse.json({
        connected: false,
        configured,
        status: config?.status ?? 'disconnected',
        fb_user_name: null,
        fb_user_email: null,
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
 * Disconnect Facebook — clears tokens, pages, forms, mappings.
 * Admin/Owner only.
 */
export async function DELETE() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const supabase = await createClient()

    // Pages cascade-deletes forms + mappings via FK
    const { error: pagesErr } = await supabase
      .from('facebook_pages')
      .delete()
      .neq('id', '')

    if (pagesErr) {
      console.error('[meta/config] DELETE pages error:', pagesErr)
    }

    const { error: configErr } = await supabase
      .from('facebook_config')
      .update({
        user_token: null,
        fb_user_id: null,
        fb_user_name: null,
        fb_user_email: null,
        token_expires_at: null,
        status: 'disconnected',
        connected_at: null,
        connected_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (configErr) {
      console.error('[meta/config] DELETE config error:', configErr)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[meta/config] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
