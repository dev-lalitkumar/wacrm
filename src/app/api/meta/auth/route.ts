import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

const SCOPES = [
  'pages_show_list',
  'pages_manage_metadata',
  'leads_retrieval',
  'pages_read_engagement',
].join(',')

/**
 * GET /api/meta/auth
 *
 * Initiates Facebook OAuth flow. Admin/Owner only.
 * Sets a CSRF cookie and redirects to Facebook's consent screen.
 */
export async function GET() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const appId = process.env.META_APP_ID
    if (!appId) {
      return NextResponse.json(
        { error: 'META_APP_ID is not configured' },
        { status: 500 },
      )
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')

    const redirectUri = `${siteUrl}/api/meta/callback`
    const state = crypto.randomBytes(32).toString('hex')

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    authUrl.searchParams.set('client_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', SCOPES)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('state', state)

    const cookieStore = await cookies()
    cookieStore.set('meta_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    })

    return NextResponse.redirect(authUrl.toString())
  } catch (err) {
    console.error('[meta/auth] error:', err)
    return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 })
  }
}
