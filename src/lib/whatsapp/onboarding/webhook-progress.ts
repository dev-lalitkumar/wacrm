import { evaluateReadiness } from './readiness'
import { getWhatsAppConfig, updateWhatsAppConfig } from './repository'

export async function recordWebhookActivity(args: {
  phoneNumberId: string
  kind: 'inbound' | 'outbound_status'
  messageId?: string
  status?: string
}): Promise<void> {
  const config = await getWhatsAppConfig()
  if (!config || config.phone_number_id !== args.phoneNumberId) return

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    webhook_last_received_at: now,
  }

  if (args.kind === 'inbound') {
    patch.last_inbound_message_at = now
  }

  const step = config.onboarding_step

  if (
    step === 'COEXISTENCE_VERIFIED' ||
    (step === 'EMBEDDED_SIGNUP_COMPLETED' && config.webhook_subscription_status === 'subscribed')
  ) {
    patch.webhook_verified = true
    patch.status = 'WEBHOOK_VERIFIED'
    patch.onboarding_step = 'WEBHOOK_VERIFIED'
  }

  if (
    args.kind === 'outbound_status' &&
    args.messageId &&
    config.last_test_message_id === args.messageId
  ) {
    const delivered = args.status === 'delivered' || args.status === 'read'
    const sent = args.status === 'sent' || delivered
    if (sent) {
      patch.status = 'TEST_MESSAGE_SENT'
      patch.onboarding_step = 'TEST_MESSAGE_SENT'
      patch.last_outbound_message_at = now
    }
  }

  await updateWhatsAppConfig(patch)
  await evaluateReadiness()
}
