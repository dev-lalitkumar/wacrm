/**
 * WhatsApp channel — sends plain text to team members when org WhatsApp is active.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getDecryptedWhatsAppCredentials } from '@/lib/whatsapp/credentials'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import { renderTemplate } from '../template-engine'
import type { ChannelSendArgs, NotificationChannel } from '../types'

export class WhatsAppChannel implements NotificationChannel {
  name = 'whatsapp' as const

  async isConfigured(_admin: SupabaseClient): Promise<boolean> {
    const creds = await getDecryptedWhatsAppCredentials()
    return !!creds?.canMessage
  }

  async send({ recipients, template, context }: ChannelSendArgs): Promise<void> {
    const creds = await getDecryptedWhatsAppCredentials()
    if (!creds?.canMessage) return

    const text = renderTemplate(template.body, context)

    const targets = recipients
      .map((r) => (r.phone ? sanitizePhoneForMeta(r.phone) : null))
      .filter((p): p is string => !!p && isValidE164(p))

    await Promise.allSettled(
      targets.map((to) =>
        sendTextMessage({
          phoneNumberId: creds.phoneNumberId,
          accessToken: creds.accessToken,
          to,
          text,
        }).catch((err) => console.error('[notifications/whatsapp] send failed:', err)),
      ),
    )
  }
}
