import { decrypt } from '@/lib/encryption'
import { verifyAssets } from './asset-verification'
import { verifyCoexistence } from './coexistence-validation'
import { verifyPermissions } from './permission-verification'
import { getWhatsAppConfig, markFailed, updateWhatsAppConfig } from './repository'
import { sendOnboardingTestMessage } from './test-messaging'
import { setupWebhookSubscription } from './webhook-health'

export async function runOnboardingPipeline(): Promise<void> {
  const config = await getWhatsAppConfig()
  if (!config?.access_token) {
    await markFailed('No credentials saved')
    return
  }

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    await markFailed('Cannot decrypt access token')
    return
  }

  const asset = await verifyAssets(config, accessToken)
  if (!asset.ok) {
    await markFailed(asset.error ?? 'Asset verification failed')
    return
  }

  const refreshed = await getWhatsAppConfig()
  if (!refreshed) return

  const perms = await verifyPermissions(accessToken)
  if (!perms.ok) return

  const coexist = await verifyCoexistence(refreshed, accessToken)
  if (!coexist.ok) {
    await markFailed(coexist.error ?? 'Coexistence validation failed')
    return
  }

  const afterCoexist = await getWhatsAppConfig()
  if (!afterCoexist) return

  const webhook = await setupWebhookSubscription(afterCoexist, accessToken)
  if (!webhook.ok) {
    await markFailed(webhook.error ?? 'Webhook setup failed')
    return
  }

  const test = await sendOnboardingTestMessage(afterCoexist, accessToken)
  if (!test.ok) {
    await markFailed(test.error ?? 'Test message failed')
    return
  }

  await updateWhatsAppConfig({
    token_last_verified_at: new Date().toISOString(),
  })
}
