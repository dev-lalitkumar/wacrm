import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'owner' | 'manager' | 'executive'

export interface AuthedCaller {
  userId: string
  profileId: string
  email: string
  fullName: string
  role: Role
  isActive: boolean
  mustChangePassword: boolean
}

/**
 * Resolve the current request's signed-in user and matching active
 * profile row. Returns null when no user is signed in or no active
 * profile exists. Server-only.
 */
export async function getAuthedCaller(): Promise<AuthedCaller | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, user_id, email, full_name, role, is_active, must_change_password',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  if (!data.is_active) return null

  return {
    userId: data.user_id,
    profileId: data.id,
    email: data.email,
    fullName: data.full_name ?? '',
    role: data.role as Role,
    isActive: data.is_active,
    mustChangePassword: data.must_change_password,
  }
}

/**
 * Ensure the request comes from an authed user whose role is in
 * `allowed`. Returns the caller on success; a NextResponse error
 * (401 or 403) on failure that the route can return directly.
 */
export async function requireRole(
  allowed: Role[],
): Promise<AuthedCaller | NextResponse> {
  const caller = await getAuthedCaller()
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!allowed.includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return caller
}

/**
 * True when `value` is a NextResponse — used to narrow the
 * union return type of `requireRole` in route handlers.
 */
export function isErrorResponse(
  value: AuthedCaller | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse
}
