import { decrypt } from '@/lib/encryption'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'
import { getWhatsAppConfig, updateWhatsAppConfig } from './repository'

export async function runTokenHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  const config = await getWhatsAppConfig()
  if (!config?.access_token || !config.phone_number_id) {
    return { ok: false, error: 'not_configured' }
  }

  try {
    const accessToken = decrypt(config.access_token)
    await verifyPhoneNumber({
      phoneNumberId: config.phone_number_id,
      accessToken,
    })
    await updateWhatsAppConfig({
      token_last_verified_at: new Date().toISOString(),
    })
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token invalid'
    return { ok: false, error: msg }
  }
}

export async function runDailyHealthCheck(): Promise<{
  webhook_stale: boolean
  quality_rating: string | null
  messaging_limit_tier: string | null
}> {
  const config = await getWhatsAppConfig()
  if (!config) {
    return { webhook_stale: false, quality_rating: null, messaging_limit_tier: null }
  }

  let webhookStale = false
  if (config.webhook_last_received_at) {
    const age = Date.now() - new Date(config.webhook_last_received_at).getTime()
    webhookStale = age > 24 * 60 * 60 * 1000
  } else if (config.status === 'READY') {
    webhookStale = true
  }

  if (config.access_token && config.phone_number_id) {
    try {
      const accessToken = decrypt(config.access_token)
      const phone = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
      await updateWhatsAppConfig({
        quality_rating: phone.quality_rating ?? config.quality_rating,
        messaging_limit_tier: config.messaging_limit_tier,
        phone_number: phone.display_phone_number ?? config.phone_number,
        verified_name: phone.verified_name ?? config.verified_name,
      })
      return {
        webhook_stale: webhookStale,
        quality_rating: phone.quality_rating ?? null,
        messaging_limit_tier: config.messaging_limit_tier,
      }
    } catch {
      return {
        webhook_stale: webhookStale,
        quality_rating: config.quality_rating,
        messaging_limit_tier: config.messaging_limit_tier,
      }
    }
  }

  return {
    webhook_stale: webhookStale,
    quality_rating: config.quality_rating,
    messaging_limit_tier: config.messaging_limit_tier,
  }
}
