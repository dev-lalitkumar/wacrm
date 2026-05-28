import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/encryption'
import { exchangeCodeForTokens, getGmailProfile } from '@/lib/gmail/client'

/**
 * GET /api/gmail/callback
 *
 * Google redirects here after the user consents. Exchanges the auth
 * code for tokens, verifies the connected email, and stores everything
 * encrypted in the `gmail_config` singleton.
 */
export async function GET(request: NextRequest) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle user denial or errors from Google
    if (error) {
      console.warn('[gmail/callback] OAuth error from Google:', error)
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=${encodeURIComponent(error)}`,
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=missing_params`,
      )
    }

    // CSRF check
    const cookieStore = await cookies()
    const storedState = cookieStore.get('gmail_oauth_state')?.value
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=invalid_state`,
      )
    }
    // Clear the state cookie
    cookieStore.delete('gmail_oauth_state')

    // Verify auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=unauthorized`,
      )
    }

    // Get the caller's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=forbidden`,
      )
    }

    // Exchange code for tokens
    const redirectUri = `${siteUrl}/api/gmail/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Verify the tokens work by fetching the Gmail profile
    const gmailProfile = await getGmailProfile(tokens.accessToken)

    // Store everything encrypted
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000)

    const { error: updateError } = await supabase
      .from('gmail_config')
      .update({
        access_token: encrypt(tokens.accessToken),
        refresh_token: encrypt(tokens.refreshToken),
        token_expiry: tokenExpiry.toISOString(),
        connected_email: gmailProfile.email,
        status: 'connected',
        scopes: tokens.scope.split(' '),
        connected_at: new Date().toISOString(),
        connected_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    if (updateError) {
      console.error('[gmail/callback] DB update error:', updateError)
      return NextResponse.redirect(
        `${siteUrl}/settings?tab=email&gmail_error=db_error`,
      )
    }

    return NextResponse.redirect(
      `${siteUrl}/settings?tab=email&gmail_success=true`,
    )
  } catch (err) {
    console.error('[gmail/callback] error:', err)
    return NextResponse.redirect(
      `${siteUrl}/settings?tab=email&gmail_error=unexpected`,
    )
  }
}
