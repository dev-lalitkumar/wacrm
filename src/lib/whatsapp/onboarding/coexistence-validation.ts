import { getPhoneNumberDetails } from '@/lib/whatsapp/meta-api'
import { updateWhatsAppConfig } from './repository'
import type { WhatsAppConfig } from './types'

export async function verifyCoexistence(
  config: WhatsAppConfig,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.phone_number_id) {
    return { ok: false, error: 'Phone number ID missing' }
  }

  try {
    const phone = await getPhoneNumberDetails({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })

    const onBizApp = phone.is_on_biz_app === true
    const platformOk =
      !phone.platform_type ||
      phone.platform_type === 'CLOUD_API' ||
      phone.platform_type === 'NOT_APPLICABLE'

    if (!platformOk) {
      await updateWhatsAppConfig({
        coexistence_enabled: false,
        status: 'FAILED',
        onboarding_step: 'FAILED',
        failure_reason: `Unsupported phone platform: ${phone.platform_type}`,
      })
      return { ok: false, error: 'Coexistence Validation Failed' }
    }

    if (!onBizApp && config.connection_type === 'embedded_signup') {
      await updateWhatsAppConfig({
        coexistence_enabled: false,
        status: 'FAILED',
        onboarding_step: 'FAILED',
        failure_reason: 'Number is not connected to WhatsApp Business App',
      })
      return { ok: false, error: 'Coexistence Validation Failed' }
    }

    await updateWhatsAppConfig({
      coexistence_enabled: true,
      status: 'COEXISTENCE_VERIFIED',
      onboarding_step: 'COEXISTENCE_VERIFIED',
      failure_reason: null,
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Coexistence validation failed'
    return { ok: false, error: msg }
  }
}
