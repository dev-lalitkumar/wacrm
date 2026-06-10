import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { getWhatsAppConfig } from '@/lib/whatsapp/onboarding/repository'
import { runDailyHealthCheck } from '@/lib/whatsapp/onboarding/health'

export async function GET() {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const config = await getWhatsAppConfig()
  const daily = await runDailyHealthCheck()

  const webhookStale =
    daily.webhook_stale ||
    (!config?.webhook_last_received_at && config?.status === 'READY')

  return NextResponse.json({
    status:
      config?.status === 'READY' && !webhookStale
        ? 'healthy'
        : config?.status === 'FAILED'
          ? 'failed'
          : 'degraded',
    onboarding_status: config?.status ?? 'NOT_CONNECTED',
    phone_number: config?.phone_number,
    display_name: config?.display_name ?? config?.verified_name,
    quality_rating: daily.quality_rating ?? config?.quality_rating,
    messaging_limit_tier: config?.messaging_limit_tier,
    webhook_last_received_at: config?.webhook_last_received_at,
    token_last_verified_at: config?.token_last_verified_at,
    last_inbound_message_at: config?.last_inbound_message_at,
    last_outbound_message_at: config?.last_outbound_message_at,
    webhook_stale: webhookStale,
    coexistence_enabled: config?.coexistence_enabled ?? false,
    failure_reason: config?.failure_reason,
  })
}
