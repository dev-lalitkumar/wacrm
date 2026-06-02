/**
 * WhatsApp channel — sends a plain text message to each recipient's
 * `profiles.phone` via the connected WhatsApp Business account. Active only
 * when `whatsapp_config.status = 'connected'`.
 *
 * NOTE: Meta only delivers free-form text inside the 24-hour customer-initiated
 * window (or to whitelisted test numbers). For team-member notifications this
 * is best-effort — rejections are caught and logged, never thrown. A
 * pre-approved template path is a future enhancement.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import { sanitizePhoneForMeta, isValidE164 } from '@/lib/whatsapp/phone-utils'
import { renderTemplate } from '../template-engine'
import type { ChannelSendArgs, NotificationChannel } from '../types'

export class WhatsAppChannel implements NotificationChannel {
  name = 'whatsapp' as const

  async isConfigured(admin: SupabaseClient): Promise<boolean> {
    const { data } = await admin.from('whatsapp_config').select('status').limit(1).maybeSingle()
    return data?.status === 'connected'
  }

  async send({ recipients, template, context }: ChannelSendArgs): Promise<void> {
    const admin = supabaseAdmin()
    const { data: config } = await admin
      .from('whatsapp_config')
      .select('phone_number_id, access_token')
      .limit(1)
      .maybeSingle()
    if (!config?.phone_number_id || !config.access_token) return

    let accessToken: string
    try {
      accessToken = decrypt(config.access_token)
    } catch (err) {
      console.error('[notifications/whatsapp] failed to decrypt token:', err)
      return
    }

    const text = renderTemplate(template.body, context)

    const targets = recipients
      .map((r) => (r.phone ? sanitizePhoneForMeta(r.phone) : null))
      .filter((p): p is string => !!p && isValidE164(p))

    await Promise.allSettled(
      targets.map((to) =>
        sendTextMessage({
          phoneNumberId: config.phone_number_id as string,
          accessToken,
          to,
          text,
        }).catch((err) => console.error('[notifications/whatsapp] send failed:', err)),
      ),
    )
  }
}
