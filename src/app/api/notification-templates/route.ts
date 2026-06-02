import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

/**
 * GET /api/notification-templates
 *
 * List all notification templates (admin/owner only). RLS already allows any
 * authenticated user to read, but the management UI is admin/owner-gated.
 */
export async function GET(): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('event_type', { ascending: true })
    .order('channel', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}
