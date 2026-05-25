import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { getAuthedCaller } from '@/lib/auth/require-role'

// ============================================================
// POST /api/users/me/change-password
// Any signed-in user. Re-authenticates the caller with their
// current password, then sets the new one via auth.updateUser
// (which uses the cookie-bound user-scoped client). Finally
// clears must_change_password so the forced-change redirect
// no longer fires.
//
// `current_password` is required so a leaked session cookie
// can't be used to pivot the password without proof of the
// current credential.
// ============================================================
export async function POST(request: Request) {
  const caller = await getAuthedCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    current_password?: string
    new_password?: string
  } | null

  if (!body?.current_password || !body?.new_password) {
    return NextResponse.json(
      { error: 'current_password and new_password are required' },
      { status: 400 },
    )
  }

  if (body.new_password.length < 8) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters' },
      { status: 400 },
    )
  }

  const supabase = await createClient()

  // Verify the current password by attempting a sign-in. We don't
  // care about the session it returns — we just need the success
  // signal. The browser already has a valid cookie-based session
  // from middleware, so this doesn't change the active session.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: caller.email,
    password: body.current_password,
  })

  if (signInErr) {
    return NextResponse.json(
      { error: 'Current password is incorrect' },
      { status: 400 },
    )
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: body.new_password,
  })

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Service-role write — RLS would otherwise refuse to update
  // anyone but the caller's row through the user-scoped client,
  // and even then we want this clear to succeed unconditionally.
  const admin = supabaseAdmin()
  const { error: flagErr } = await admin
    .from('profiles')
    .update({ must_change_password: false })
    .eq('user_id', caller.userId)

  if (flagErr) {
    return NextResponse.json({ error: flagErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
