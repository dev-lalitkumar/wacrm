import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import {
  requireRole,
  isErrorResponse,
  type Role,
} from '@/lib/auth/require-role'
import { writeAuditLog } from '@/lib/audit/log'

const VALID_ROLES: Role[] = ['admin', 'owner', 'manager', 'executive']

type Admin = ReturnType<typeof supabaseAdmin>

// Count the customer data a profile currently owns. Used to decide
// whether deactivation must be accompanied by a data transfer.
async function countOwnedRecords(
  admin: Admin,
  profileId: string,
): Promise<{ deals: number; contacts: number }> {
  const [dealsRes, contactsRes] = await Promise.all([
    admin.from('deals').select('id', { count: 'exact', head: true }).eq('assigned_to', profileId),
    admin.from('contacts').select('id', { count: 'exact', head: true }).eq('assigned_to', profileId),
  ])
  return { deals: dealsRes.count ?? 0, contacts: contactsRes.count ?? 0 }
}

// Move every deal and contact owned by `fromProfileId` to `toProfileId`.
// The migration-017 trigger keeps deal↔contact assignment in sync, so
// updating both tables explicitly is safe and idempotent. Throws on the
// first failure so the caller can abort before deactivating the user.
async function reassignOwnedRecords(
  admin: Admin,
  fromProfileId: string,
  toProfileId: string,
): Promise<void> {
  const { error: dealErr } = await admin
    .from('deals')
    .update({ assigned_to: toProfileId })
    .eq('assigned_to', fromProfileId)
  if (dealErr) throw new Error(`Failed to reassign deals: ${dealErr.message}`)

  const { error: contactErr } = await admin
    .from('contacts')
    .update({ assigned_to: toProfileId })
    .eq('assigned_to', fromProfileId)
  if (contactErr) throw new Error(`Failed to reassign contacts: ${contactErr.message}`)
}

// Validate a transfer destination and move data onto it. Returns an
// error response on bad input, or null on success. `from` is the user
// being deactivated; `reassignTo` is the chosen destination profile id.
async function transferDataOrError(
  admin: Admin,
  from: string,
  reassignTo: unknown,
): Promise<NextResponse | null> {
  const owned = await countOwnedRecords(admin, from)
  const total = owned.deals + owned.contacts

  if (total === 0) return null // nothing to transfer

  if (typeof reassignTo !== 'string' || !reassignTo) {
    return NextResponse.json(
      {
        error:
          'This user still owns data. Choose a teammate to transfer it to.',
        owned,
      },
      { status: 400 },
    )
  }
  if (reassignTo === from) {
    return NextResponse.json(
      { error: 'Cannot transfer data to the user being deactivated' },
      { status: 400 },
    )
  }

  const { data: dest } = await admin
    .from('profiles')
    .select('id, is_active')
    .eq('id', reassignTo)
    .maybeSingle()

  if (!dest || !dest.is_active) {
    return NextResponse.json(
      { error: 'Transfer destination must be an active team member' },
      { status: 400 },
    )
  }

  await reassignOwnedRecords(admin, from, reassignTo)
  return null
}

// ============================================================
// GET /api/users/[id]
// Admin / Owner only. Returns how much reassignable data the user
// owns — used to drive the "transfer data" step before deactivation.
// ============================================================
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const admin = supabaseAdmin()

  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const owned = await countOwnedRecords(admin, id)
  return NextResponse.json({ owned })
}

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
    /** Destination profile id for data transfer when deactivating. */
    reassign_to?: string
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

  // Deactivating an active user: their deals/contacts must not be left
  // stranded on a disabled account. Transfer them first, aborting the
  // whole operation if the transfer can't be satisfied.
  if (target.is_active && willBeActive === false) {
    const transferError = await transferDataOrError(admin, id, body.reassign_to)
    if (transferError) return transferError
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

  // Audit role / activation changes (the sensitive bits).
  if ('role' in updates || 'is_active' in updates) {
    const action =
      'is_active' in updates && updates.is_active === false ? 'user.deactivated'
      : 'role' in updates ? 'user.role_changed'
      : 'user.updated'
    void writeAuditLog({
      actorProfileId: caller.profileId,
      actorName: caller.fullName,
      action,
      entityType: 'user',
      entityId: id,
      detail: {
        target_name: updated.full_name,
        before: { role: target.role, is_active: target.is_active },
        after: { role: updated.role, is_active: updated.is_active },
      },
    })
  }

  return NextResponse.json({ user: updated })
}

// ============================================================
// DELETE /api/users/[id]
// Admin only — soft delete (is_active = false). Hard delete is
// out of scope (would cascade `user_id` FKs across the schema).
// ============================================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const admin = supabaseAdmin()

  const body = (await request.json().catch(() => null)) as {
    reassign_to?: string
  } | null

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

  // Transfer owned data off the account before disabling it.
  if (target.is_active) {
    const transferError = await transferDataOrError(admin, id, body?.reassign_to)
    if (transferError) return transferError
  }

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  void writeAuditLog({
    actorProfileId: caller.profileId,
    actorName: caller.fullName,
    action: 'user.deactivated',
    entityType: 'user',
    entityId: id,
    detail: { reassigned_to: body?.reassign_to ?? null },
  })

  return NextResponse.json({ ok: true })
}
