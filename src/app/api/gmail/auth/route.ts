import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getOAuthUrl } from '@/lib/gmail/client'

/**
 * GET /api/gmail/auth
 *
 * Initiates the Google OAuth flow. Admin/Owner only.
 * Generates a CSRF state token, stores it in a cookie, and redirects
 * the user to Google's consent screen.
 */
export async function GET() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'GOOGLE_CLIENT_ID is not configured' },
        { status: 500 },
      )
    }

    // CSRF protection — random state stored in httpOnly cookie
    const state = crypto.randomBytes(32).toString('hex')

    // Derive redirect URI from the request
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')
    const redirectUri = `${siteUrl}/api/gmail/callback`

    const authUrl = getOAuthUrl(redirectUri)
    const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`

    // Set the CSRF cookie (5 minutes TTL)
    const cookieStore = await cookies()
    cookieStore.set('gmail_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    })

    return NextResponse.redirect(urlWithState)
  } catch (err) {
    console.error('[gmail/auth] error:', err)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 },
    )
  }
}
