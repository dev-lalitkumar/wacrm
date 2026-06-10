import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getWhatsAppConfig, updateWhatsAppConfig } from '@/lib/whatsapp/onboarding/repository'
import { scheduleOnboardingPipeline } from '@/lib/whatsapp/onboarding/schedule'

export async function POST() {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const config = await getWhatsAppConfig()
  if (!config?.access_token) {
    return NextResponse.json({ error: 'No WhatsApp credentials to verify' }, { status: 400 })
  }

  await updateWhatsAppConfig({
    status: 'EMBEDDED_SIGNUP_COMPLETED',
    onboarding_step: 'EMBEDDED_SIGNUP_COMPLETED',
    failure_reason: null,
    webhook_verified: false,
    is_active: true,
  })

  scheduleOnboardingPipeline()

  return NextResponse.json({ success: true, status: 'EMBEDDED_SIGNUP_COMPLETED' })
}
