import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { updateWhatsAppConfig } from './repository'
import type { WhatsAppConfig } from './types'

const TEST_MESSAGE = 'WhatsApp connection successful.'

export async function sendOnboardingTestMessage(
  config: WhatsAppConfig,
  accessToken: string,
): Promise<{ ok: boolean; error?: string; messageId?: string }> {
  if (!config.phone_number_id || !config.onboarding_test_phone) {
    return { ok: false, error: 'Test phone number not configured' }
  }

  try {
    const to = normalizePhone(config.onboarding_test_phone)
    const result = await sendTextMessage({
      phoneNumberId: config.phone_number_id,
      accessToken,
      to,
      text: TEST_MESSAGE,
    })

    await updateWhatsAppConfig({
      last_test_message_id: result.messageId,
      last_outbound_message_at: new Date().toISOString(),
    })

    return { ok: true, messageId: result.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Test message failed'
    return { ok: false, error: msg }
  }
}
