import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

// ============================================================
// POST /api/users/[id]/reset-password
// Admin / Owner. Sets a new temp password via the admin SDK and
// flips must_change_password = true so the user is forced into
// the change-password flow on next login.
// ============================================================
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const admin = supabaseAdmin()

  const body = (await request.json().catch(() => null)) as {
    temp_password?: string
  } | null

  const tempPassword = body?.temp_password ?? ''
  if (!tempPassword || tempPassword.length < 8) {
    return NextResponse.json(
      { error: 'Temporary password must be at least 8 characters' },
      { status: 400 },
    )
  }

  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id, user_id, role')
    .eq('id', id)
    .maybeSingle()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (caller.role === 'owner' && target.role === 'admin') {
    return NextResponse.json(
      { error: 'Owners cannot reset an Admin password' },
      { status: 403 },
    )
  }

  const { error: updateAuthErr } = await admin.auth.admin.updateUserById(
    target.user_id,
    { password: tempPassword },
  )

  if (updateAuthErr) {
    return NextResponse.json({ error: updateAuthErr.message }, { status: 500 })
  }

  const { error: flagErr } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', id)

  if (flagErr) {
    return NextResponse.json({ error: flagErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
