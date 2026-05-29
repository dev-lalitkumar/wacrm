import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

/**
 * GET /api/meta/whatsapp/status
 *
 * Returns the WhatsApp configuration status for coexistence display.
 * Only returns phone_number_id and waba_id (never exposes access token).
 */
export async function GET() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const supabase = await createClient()
    const { data } = await supabase
      .from('whatsapp_config')
      .select('phone_number_id, waba_id, status')
      .eq('user_id', caller.userId)
      .maybeSingle()

    if (!data || data.status !== 'connected') {
      return NextResponse.json({ connected: false, phone_number_id: null, waba_id: null })
    }

    return NextResponse.json({
      connected: true,
      phone_number_id: data.phone_number_id,
      waba_id: data.waba_id ?? null,
    })
  } catch (err) {
    console.error('[meta/whatsapp/status] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
