import { subscribeWabaWebhooks } from '@/lib/whatsapp/meta-api'
import { updateWhatsAppConfig } from './repository'
import type { WhatsAppConfig } from './types'

export async function setupWebhookSubscription(
  config: WhatsAppConfig,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.waba_id) {
    return { ok: false, error: 'WABA ID missing' }
  }

  const verifyToken =
    process.env.META_WEBHOOK_VERIFY_TOKEN ??
    (config.verify_token ? 'configured' : null)

  if (!verifyToken) {
    return {
      ok: false,
      error: 'Webhook verify token not configured (META_WEBHOOK_VERIFY_TOKEN or manual verify_token)',
    }
  }

  try {
    await subscribeWabaWebhooks({ wabaId: config.waba_id, accessToken })
    await updateWhatsAppConfig({
      webhook_subscription_status: 'subscribed',
      failure_reason: null,
    })
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook subscription failed'
    await updateWhatsAppConfig({
      webhook_subscription_status: 'failed',
    })
    return { ok: false, error: msg }
  }
}
