import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'

// Public probe used by the signup page to decide whether to render
// the form or the "signup disabled" screen. The DB trigger
// `handle_new_user` is the real enforcer; this exists only for UX.
export async function GET() {
  const admin = supabaseAdmin()
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  if (error) {
    // Fail closed — if we can't check, assume signup is closed so we
    // don't accidentally expose the form on a broken DB.
    return NextResponse.json({ open: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ open: (count ?? 0) === 0 })
}
