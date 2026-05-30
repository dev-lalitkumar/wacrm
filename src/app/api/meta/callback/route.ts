import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import {
  exchangeCodeForToken,
  getLongLivedUserToken,
  getFacebookUserInfo,
  getPages,
} from '@/lib/meta/facebook-api'

/**
 * GET /api/meta/callback
 *
 * Facebook redirects here after user consents.
 * Exchanges code → short-lived token → long-lived token,
 * fetches user info + pages, stores encrypted in DB.
 */
export async function GET(request: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

  // Encode reason + human message into redirect so UI can surface it
  const fail = (reason: string, detail?: string) => {
    const params = new URLSearchParams({ tab: 'meta', meta_error: reason })
    if (detail) params.set('meta_error_detail', detail)
    console.error(`[meta/callback] FAIL reason=${reason}${detail ? ` detail="${detail}"` : ''}`)
    return NextResponse.redirect(`${siteUrl}/settings?${params.toString()}`)
  }

  // ── 1. Check for Facebook-side OAuth errors ────────────────
  const sp = request.nextUrl.searchParams
  const code = sp.get('code')
  const state = sp.get('state')
  const fbError = sp.get('error')
  const fbErrorDesc = sp.get('error_description')

  if (fbError) {
    console.warn('[meta/callback] Facebook returned OAuth error:', fbError, fbErrorDesc)
    return fail(encodeURIComponent(fbError), fbErrorDesc ?? undefined)
  }

  if (!code || !state) {
    console.warn('[meta/callback] Missing code or state in callback. code present:', !!code, 'state present:', !!state)
    return fail('missing_params', 'Facebook did not return a code or state parameter.')
  }

  // ── 2. CSRF check ──────────────────────────────────────────
  let cookieStore: Awaited<ReturnType<typeof cookies>>
  try {
    cookieStore = await cookies()
  } catch (err) {
    console.error('[meta/callback] Failed to read cookies:', err)
    return fail('cookie_error', 'Could not read session cookies.')
  }

  const storedState = cookieStore.get('meta_oauth_state')?.value
  console.log('[meta/callback] CSRF check — stored:', storedState ? 'present' : 'MISSING', '| received:', state.slice(0, 8) + '...')

  if (!storedState) {
    return fail('invalid_state', 'OAuth state cookie was missing. This can happen if the browser blocked cookies, or if the session expired (5 min timeout). Try again.')
  }
  if (storedState !== state) {
    return fail('invalid_state', 'OAuth state mismatch. Possible CSRF or stale tab. Try again.')
  }
  cookieStore.delete('meta_oauth_state')

  // ── 3. Verify auth + role ──────────────────────────────────
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (err) {
    console.error('[meta/callback] Failed to create Supabase client:', err)
    return fail('auth_error', 'Could not connect to the database.')
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.warn('[meta/callback] Not authenticated. authError:', authError?.message)
    return fail('unauthorized', 'You must be signed in to connect Facebook.')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
    console.warn('[meta/callback] Forbidden. profile role:', profile?.role)
    return fail('forbidden', 'Only Admins and Owners can connect Facebook.')
  }

  // ── 4. Check env vars ──────────────────────────────────────
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) {
    console.error('[meta/callback] Missing env vars — META_APP_ID:', !!appId, '| META_APP_SECRET:', !!appSecret)
    return fail('missing_env', 'META_APP_ID or META_APP_SECRET is not configured on the server.')
  }

  const redirectUri = `${siteUrl}/api/meta/callback`
  console.log('[meta/callback] Using redirectUri:', redirectUri)

  // ── 5. Exchange code → short-lived token ──────────────────
  let shortToken: string
  try {
    const res = await exchangeCodeForToken(code, redirectUri)
    shortToken = res.access_token
    console.log('[meta/callback] Short-lived token obtained successfully')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[meta/callback] exchangeCodeForToken failed:', msg)
    return fail('token_exchange_failed', `Could not exchange code for token: ${msg}`)
  }

  // ── 6. Extend to long-lived token (~60 days) ──────────────
  let longToken: string
  let tokenExpiresAt: number
  try {
    const res = await getLongLivedUserToken(shortToken)
    longToken = res.access_token
    const expiresIn = res.expires_in ?? 5184000
    tokenExpiresAt = Math.floor(Date.now() / 1000) + expiresIn
    console.log('[meta/callback] Long-lived token obtained. Expires in ~', Math.round(expiresIn / 86400), 'days')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[meta/callback] getLongLivedUserToken failed:', msg)
    return fail('token_exchange_failed', `Could not extend token: ${msg}`)
  }

  // ── 7. Fetch Facebook user info ───────────────────────────
  let fbUser: { id: string; name: string; email?: string }
  try {
    fbUser = await getFacebookUserInfo(longToken)
    console.log('[meta/callback] Got FB user info for user ID:', fbUser.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[meta/callback] getFacebookUserInfo failed:', msg)
    return fail('user_info_failed', `Could not fetch Facebook user info: ${msg}`)
  }

  // ── 8. Fetch pages ────────────────────────────────────────
  let pages: Awaited<ReturnType<typeof getPages>>
  try {
    pages = await getPages(longToken)
    console.log('[meta/callback] Fetched', pages.length, 'Facebook pages')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[meta/callback] getPages failed:', msg)
    // Non-fatal — continue with 0 pages
    pages = []
    console.warn('[meta/callback] Continuing without pages; they can be re-synced.')
  }

  // ── 9. Save to facebook_config ────────────────────────────
  const { error: configErr } = await supabase
    .from('facebook_config')
    .update({
      user_token: encrypt(longToken),
      fb_user_id: fbUser.id,
      fb_user_name: fbUser.name,
      fb_user_email: fbUser.email ?? null,
      token_expires_at: tokenExpiresAt,
      status: 'connected',
      connected_at: new Date().toISOString(),
      connected_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (configErr) {
    console.error('[meta/callback] facebook_config update error:', configErr.message, '| code:', configErr.code)
    const hint = configErr.code === '42P01'
      ? 'The facebook_config table does not exist. Apply migration 024 first.'
      : configErr.message
    return fail('db_error', hint)
  }
  console.log('[meta/callback] facebook_config saved successfully')

  // ── 10. Save pages ────────────────────────────────────────
  if (pages.length > 0) {
    const pageRows = pages.map((p) => ({
      id: p.id,
      name: p.name,
      access_token: encrypt(p.access_token),
      category: p.category ?? null,
      picture_url: p.picture?.data?.url ?? null,
      is_subscribed: false,
      updated_at: new Date().toISOString(),
    }))

    const { error: pagesErr } = await supabase
      .from('facebook_pages')
      .upsert(pageRows, { onConflict: 'id', ignoreDuplicates: false })

    if (pagesErr) {
      // Non-fatal — config saved; pages can be re-synced
      console.error('[meta/callback] facebook_pages upsert error (non-fatal):', pagesErr.message)
    } else {
      console.log('[meta/callback] Saved', pageRows.length, 'pages')
    }
  }

  console.log('[meta/callback] OAuth flow completed successfully for user', fbUser.id)
  return NextResponse.redirect(`${siteUrl}/settings?tab=meta&meta_success=true`)
}
