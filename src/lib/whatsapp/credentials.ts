import { decrypt } from '@/lib/encryption'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { getWhatsAppConfig } from '@/lib/whatsapp/onboarding/repository'
import type { WhatsAppConfig } from '@/lib/whatsapp/onboarding/types'

export interface WhatsAppCredentials {
  config: WhatsAppConfig
  accessToken: string
  phoneNumberId: string
  wabaId: string | null
  verifyToken: string | null
  isReady: boolean
  canMessage: boolean
}

export async function getDecryptedWhatsAppCredentials(): Promise<WhatsAppCredentials | null> {
  const config = await getWhatsAppConfig(supabaseAdmin())
  if (!config?.access_token || !config.phone_number_id) return null

  let accessToken: string
  try {
    accessToken = decrypt(config.access_token)
  } catch {
    return null
  }

  let verifyToken: string | null = null
  if (config.verify_token) {
    try {
      verifyToken = decrypt(config.verify_token)
    } catch {
      verifyToken = null
    }
  }
  if (!verifyToken) {
    verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? null
  }

  return {
    config,
    accessToken,
    phoneNumberId: config.phone_number_id,
    wabaId: config.waba_id,
    verifyToken,
    isReady: config.status === 'READY',
    canMessage: config.is_active && !!config.access_token,
  }
}
