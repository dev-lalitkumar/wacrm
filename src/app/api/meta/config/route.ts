import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { supabaseAdmin } from '@/lib/supabase/admin-client'

/**
 * GET /api/meta/config
 *
 * Returns Facebook connection status. Any authenticated user may call
 * this. Never exposes tokens.
 *
 * We verify auth with the session client, then read config with the
 * admin client. facebook_config is org-wide (singleton), not user-
 * scoped, so reading it through RLS can silently return null when the
 * RLS policy isn't satisfied for that request context.
 */
export async function GET() {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = !!(process.env.META_APP_ID && process.env.META_APP_SECRET)

    // Use admin client to read — bypasses RLS on the singleton row
    const admin = supabaseAdmin()

    const { data: config, error: configErr } = await admin
      .from('facebook_config')
      .select('status, fb_user_name, fb_user_email, token_expires_at, connected_at')
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

    const admin = supabaseAdmin()

    // Pages cascade-deletes forms + mappings via FK
    const { error: pagesErr } = await admin
      .from('facebook_pages')
      .delete()
      .neq('id', '')

    if (pagesErr) {
      console.error('[meta/config] DELETE pages error:', pagesErr)
    }

    const { error: configErr } = await admin
      .from('facebook_config')
      .upsert({
        id: 1,
        user_token: null,
        fb_user_id: null,
        fb_user_name: null,
        fb_user_email: null,
        token_expires_at: null,
        status: 'disconnected',
        connected_at: null,
        connected_by: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

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
