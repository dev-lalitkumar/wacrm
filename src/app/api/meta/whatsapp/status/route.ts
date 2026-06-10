import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getWhatsAppConfig } from '@/lib/whatsapp/onboarding/repository'

/**
 * GET /api/meta/whatsapp/status
 *
 * Legacy shim — prefer GET /api/whatsapp/onboarding-status.
 */
export async function GET() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const config = await getWhatsAppConfig()
    const connected =
      !!config?.phone_number_id &&
      config.is_active &&
      (config.status === 'READY' || config.status === 'EMBEDDED_SIGNUP_COMPLETED')

    return NextResponse.json({
      connected,
      phone_number_id: config?.phone_number_id ?? null,
      waba_id: config?.waba_id ?? null,
      status: config?.status ?? 'NOT_CONNECTED',
      is_ready: config?.status === 'READY',
    })
  } catch (err) {
    console.error('[meta/whatsapp/status] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
