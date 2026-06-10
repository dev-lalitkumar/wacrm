import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getWhatsAppConfig } from '@/lib/whatsapp/onboarding/repository'
import { stepsFromStatus } from '@/lib/whatsapp/onboarding/state-machine'

export async function GET() {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const config = await getWhatsAppConfig()
  if (!config) {
    return NextResponse.json({
      status: 'NOT_CONNECTED',
      onboarding_step: 'NOT_CONNECTED',
      steps: {
        embedded_signup: false,
        asset_verification: false,
        permissions: false,
        coexistence: false,
        webhook: false,
        test_message: false,
      },
      failure_reason: null,
      phone_number_id: null,
      phone_number: null,
      display_name: null,
      is_ready: false,
    })
  }

  const steps = stepsFromStatus(config.onboarding_step)
  const webhookStep =
    config.webhook_verified && !!config.webhook_last_received_at

  return NextResponse.json({
    status: config.status,
    onboarding_step: config.onboarding_step,
    steps: {
      embedded_signup: steps.embedded_signup,
      asset_verification: steps.asset_verification,
      permissions: steps.permissions,
      coexistence: steps.coexistence,
      webhook: webhookStep,
      test_message:
        config.onboarding_step === 'TEST_MESSAGE_SENT' ||
        config.onboarding_step === 'READY',
    },
    failure_reason: config.failure_reason,
    phone_number_id: config.phone_number_id,
    phone_number: config.phone_number,
    display_name: config.display_name ?? config.verified_name,
    waba_id: config.waba_id,
    connection_type: config.connection_type,
    is_ready: config.status === 'READY',
    coexistence_enabled: config.coexistence_enabled,
    token_type: config.token_type,
    permissions_payload: config.permissions_payload,
  })
}
