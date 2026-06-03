import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { decrypt } from '@/lib/encryption'

// Connection status must always reflect the live DB row — never cache it,
// or a disconnect can keep reporting "connected" from a stale response.
export const dynamic = 'force-dynamic'

/**
 * GET /api/gmail/config
 *
 * Returns the Gmail connection status. Any signed-in user can call
 * this — the UI uses it to decide whether to show email features.
 * Never exposes tokens.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: config, error: configError } = await supabase
      .from('gmail_config')
      .select('connected_email, connected_name, connected_picture, status, scopes, connected_at, updated_at')
      .eq('id', 1)
      .maybeSingle()

    if (configError) {
      console.error('Error fetching gmail_config:', configError)
      return NextResponse.json(
        { connected: false, status: 'disconnected', configured: false },
        { status: 200 },
      )
    }

    // Check if Google OAuth env vars are configured
    const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

    if (!config || config.status !== 'connected') {
      return NextResponse.json({
        connected: false,
        status: config?.status ?? 'disconnected',
        configured,
        connected_email: null,
        connected_name: null,
        connected_picture: null,
      })
    }

    return NextResponse.json({
      connected: true,
      status: 'connected',
      configured,
      connected_email: config.connected_email,
      connected_name: config.connected_name,
      connected_picture: config.connected_picture,
      connected_at: config.connected_at,
      scopes: config.scopes,
    })
  } catch (err) {
    console.error('[gmail/config] GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/gmail/config
 *
 * Disconnect Gmail — clears all tokens, resets status, and revokes the
 * Google OAuth token so it cannot be used after disconnecting.
 * Admin/Owner only.
 */
export async function DELETE() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    // Use the service-role client for the write. Authorization is already
    // enforced by requireRole above; this bypasses RLS so the disconnect can
    // never be silently filtered to zero rows (matches the Facebook DELETE).
    const admin = supabaseAdmin()

    // Read current access token before clearing — needed for revocation.
    const { data: existing } = await admin
      .from('gmail_config')
      .select('access_token')
      .eq('id', 1)
      .maybeSingle()

    const { data: updated, error } = await admin
      .from('gmail_config')
      .update({
        access_token: null,
        refresh_token: null,
        token_expiry: null,
        connected_email: null,
        connected_name: null,
        connected_picture: null,
        status: 'disconnected',
        scopes: null,
        connected_at: null,
        connected_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .select('id')

    if (error) {
      console.error('[gmail/config] DELETE error:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect Gmail' },
        { status: 500 },
      )
    }

    if (!updated || updated.length === 0) {
      console.error('[gmail/config] DELETE affected 0 rows — config row missing')
      return NextResponse.json(
        { error: 'Failed to disconnect Gmail' },
        { status: 500 },
      )
    }

    // Best-effort token revocation — non-fatal. DB is already cleared.
    if (existing?.access_token) {
      try {
        const rawToken = decrypt(existing.access_token)
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(rawToken)}`,
          { method: 'POST' },
        )
      } catch (revokeErr) {
        console.warn('[gmail/config] token revocation failed (non-fatal):', revokeErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gmail/config] DELETE error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
