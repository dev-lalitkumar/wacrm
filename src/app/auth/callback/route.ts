import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /auth/callback?code=...&next=/reset-password
 *
 * Supabase email links (password recovery, etc.) land here. We exchange the
 * one-time PKCE `code` for a session cookie, then forward the user to `next`
 * (the password-reset screen by default). Without this handler the email link
 * just dumps a `?code=` on a page that does nothing.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/reset-password'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent('Reset link is invalid or has expired')}`, url.origin),
    )
  }

  // Only allow same-origin relative paths for `next` to avoid open redirects.
  const safeNext = next.startsWith('/') ? next : '/reset-password'
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
