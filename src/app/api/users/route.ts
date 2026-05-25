import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import {
  requireRole,
  isErrorResponse,
  type Role,
} from '@/lib/auth/require-role'

const VALID_ROLES: Role[] = ['admin', 'owner', 'manager', 'executive']

// ============================================================
// GET /api/users
// Admin / Owner / Manager. Lists every profile in the org so the
// Team tab and assignment pickers can render. Returns active and
// inactive members; the UI filters as needed.
// ============================================================
export async function GET() {
  const caller = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(caller)) return caller

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('profiles')
    .select(
      'id, user_id, full_name, email, role, avatar_url, is_active, must_change_password, created_by, created_at',
    )
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}

// ============================================================
// POST /api/users
// Admin / Owner. Creates a new auth user with a temp password.
// The DB trigger inserts the profile row using metadata supplied
// here: role, full_name, must_change_password, created_by.
// ============================================================
export async function POST(request: Request) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const body = (await request.json().catch(() => null)) as {
    full_name?: string
    email?: string
    role?: string
    temp_password?: string
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fullName = (body.full_name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const role = (body.role ?? '') as Role
  const tempPassword = body.temp_password ?? ''

  if (!fullName || !email || !role || !tempPassword) {
    return NextResponse.json(
      { error: 'full_name, email, role, and temp_password are required' },
      { status: 400 },
    )
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  if (role === 'admin' && caller.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only Admins can create Admin users' },
      { status: 403 },
    )
  }

  if (tempPassword.length < 8) {
    return NextResponse.json(
      { error: 'Temporary password must be at least 8 characters' },
      { status: 400 },
    )
  }

  const admin = supabaseAdmin()

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      must_change_password: true,
      created_by: caller.userId,
    },
  })

  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message ?? 'Failed to create user' },
      { status: 400 },
    )
  }

  // The handle_new_user trigger inserted the profile row. Fetch it
  // back so the UI has the full record (id, role, flags).
  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, user_id, full_name, email, role, avatar_url, is_active, must_change_password, created_by, created_at',
    )
    .eq('user_id', created.user.id)
    .maybeSingle()

  return NextResponse.json({ user: profile }, { status: 201 })
}
