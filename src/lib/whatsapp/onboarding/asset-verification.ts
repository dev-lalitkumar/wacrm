import { getWaba, getPhoneNumberDetails } from '@/lib/whatsapp/meta-api'
import { updateWhatsAppConfig } from './repository'
import type { WhatsAppConfig } from './types'

export async function verifyAssets(
  config: WhatsAppConfig,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.waba_id || !config.phone_number_id) {
    return { ok: false, error: 'Missing WABA or phone number ID' }
  }

  try {
    const waba = await getWaba({ wabaId: config.waba_id, accessToken })
    const phone = await getPhoneNumberDetails({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })

    if (!phone.id) {
      return { ok: false, error: 'Phone number not found in Meta' }
    }

    await updateWhatsAppConfig({
      business_id: waba.owner_business_info?.id ?? null,
      display_name: phone.display_phone_number ?? null,
      phone_number: phone.display_phone_number ?? null,
      verified_name: phone.verified_name ?? null,
      quality_rating: phone.quality_rating ?? null,
      messaging_limit_tier: phone.messaging_limit_tier ?? null,
      status: 'ASSET_VERIFIED',
      onboarding_step: 'ASSET_VERIFIED',
      failure_reason: null,
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Asset verification failed'
    return { ok: false, error: msg }
  }
}
