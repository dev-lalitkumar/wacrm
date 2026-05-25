import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import {
  requireRole,
  isErrorResponse,
  type Role,
} from '@/lib/auth/require-role'

const VALID_ROLES: Role[] = ['admin', 'owner', 'manager', 'executive']

// ============================================================
// PATCH /api/users/[id]
// Admin / Owner only.
// Body may include: full_name, role, is_active.
// Guards:
//   * Cannot change own role
//   * Owners cannot touch Admins
//   * Refuse if the change would leave zero active Admins
// ============================================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const admin = supabaseAdmin()

  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id, user_id, role, is_active')
    .eq('id', id)
    .maybeSingle()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (caller.role === 'owner' && target.role === 'admin') {
    return NextResponse.json(
      { error: 'Owners cannot modify Admin users' },
      { status: 403 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    full_name?: string
    role?: string
    is_active?: boolean
  } | null

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.full_name === 'string') {
    const trimmed = body.full_name.trim()
    if (!trimmed) {
      return NextResponse.json({ error: 'full_name cannot be empty' }, { status: 400 })
    }
    updates.full_name = trimmed
  }

  if (typeof body.role === 'string') {
    const nextRole = body.role as Role
    if (!VALID_ROLES.includes(nextRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (target.user_id === caller.userId && nextRole !== caller.role) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 403 },
      )
    }
    if (nextRole === 'admin' && caller.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only Admins can promote users to Admin' },
        { status: 403 },
      )
    }
    updates.role = nextRole
  }

  if (typeof body.is_active === 'boolean') {
    if (target.user_id === caller.userId && body.is_active === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate yourself' },
        { status: 403 },
      )
    }
    updates.is_active = body.is_active
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  // Last-active-admin guard: any change that would result in zero
  // active admins is rejected. Covers demote-the-only-admin and
  // deactivate-the-only-admin in one check.
  const willBeAdmin =
    (updates.role as Role | undefined) ?? (target.role as Role)
  const willBeActive =
    (updates.is_active as boolean | undefined) ?? target.is_active

  if (target.role === 'admin' && (willBeAdmin !== 'admin' || !willBeActive)) {
    const { count, error: countErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 })
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot demote or deactivate the last active Admin' },
        { status: 400 },
      )
    }
  }

  const { data: updated, error: updateErr } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(
      'id, user_id, full_name, email, role, avatar_url, is_active, must_change_password, created_by, created_at',
    )
    .single()

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? 'Update failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({ user: updated })
}

// ============================================================
// DELETE /api/users/[id]
// Admin only — soft delete (is_active = false). Hard delete is
// out of scope (would cascade `user_id` FKs across the schema).
// ============================================================
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const admin = supabaseAdmin()

  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id, user_id, role, is_active')
    .eq('id', id)
    .maybeSingle()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (target.user_id === caller.userId) {
    return NextResponse.json(
      { error: 'You cannot deactivate yourself' },
      { status: 403 },
    )
  }

  if (target.role === 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot deactivate the last active Admin' },
        { status: 400 },
      )
    }
  }

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
