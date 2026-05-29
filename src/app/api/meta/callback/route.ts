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

  const fail = (reason: string) =>
    NextResponse.redirect(`${siteUrl}/settings?tab=meta&meta_error=${reason}`)

  try {
    const sp = request.nextUrl.searchParams
    const code = sp.get('code')
    const state = sp.get('state')
    const error = sp.get('error')

    if (error) {
      console.warn('[meta/callback] OAuth error from Facebook:', error)
      return fail(encodeURIComponent(error))
    }

    if (!code || !state) return fail('missing_params')

    // CSRF check
    const cookieStore = await cookies()
    const storedState = cookieStore.get('meta_oauth_state')?.value
    if (!storedState || storedState !== state) return fail('invalid_state')
    cookieStore.delete('meta_oauth_state')

    // Verify auth + role
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return fail('unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return fail('forbidden')
    }

    const redirectUri = `${siteUrl}/api/meta/callback`

    // code → short-lived token
    const shortTokenRes = await exchangeCodeForToken(code, redirectUri)
    const shortToken = shortTokenRes.access_token

    // short-lived → long-lived (~60 days)
    const longTokenRes = await getLongLivedUserToken(shortToken)
    const longToken = longTokenRes.access_token
    const expiresIn = longTokenRes.expires_in ?? 5184000 // 60 days fallback
    const tokenExpiresAt = Math.floor(Date.now() / 1000) + expiresIn

    // Fetch user profile
    const fbUser = await getFacebookUserInfo(longToken)

    // Fetch pages
    const pages = await getPages(longToken)

    // Upsert facebook_config singleton
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
      console.error('[meta/callback] config upsert error:', configErr)
      return fail('db_error')
    }

    // Upsert pages
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
        console.error('[meta/callback] pages upsert error:', pagesErr)
        // Non-fatal — config is saved; pages can be re-synced
      }
    }

    return NextResponse.redirect(`${siteUrl}/settings?tab=meta&meta_success=true`)
  } catch (err) {
    console.error('[meta/callback] error:', err)
    return fail('unexpected')
  }
}
