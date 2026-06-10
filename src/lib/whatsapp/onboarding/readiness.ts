import { getWhatsAppConfig, updateWhatsAppConfig } from './repository'
import { stepsFromStatus } from './state-machine'
import type { OnboardingStatus } from './types'

export async function evaluateReadiness(): Promise<OnboardingStatus> {
  const config = await getWhatsAppConfig()
  if (!config) return 'NOT_CONNECTED'

  const steps = stepsFromStatus(config.onboarding_step)
  const webhookOk = config.webhook_verified && !!config.webhook_last_received_at
  const testOk =
    config.onboarding_step === 'TEST_MESSAGE_SENT' ||
    config.onboarding_step === 'READY' ||
    (config.last_test_message_id != null && steps.test_message)

  const allReady =
    steps.embedded_signup &&
    steps.asset_verification &&
    steps.permissions &&
    steps.coexistence &&
    webhookOk &&
    testOk &&
    config.permissions_verified &&
    config.coexistence_enabled

  if (allReady && config.status !== 'READY') {
    await updateWhatsAppConfig({
      status: 'READY',
      onboarding_step: 'READY',
      is_active: true,
      failure_reason: null,
    })
    return 'READY'
  }

  return config.status
}
