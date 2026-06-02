/**
 * Email channel — sends via the connected Gmail account. Active only when
 * `gmail_config.status = 'connected'`. The template title is the subject,
 * the body is plain text. Each recipient gets their own email; individual
 * failures are logged and do not abort the rest.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { getGmailTokens, sendEmail } from '@/lib/gmail/client'
import { renderTemplate } from '../template-engine'
import type { ChannelSendArgs, NotificationChannel } from '../types'

export class EmailChannel implements NotificationChannel {
  name = 'email' as const

  async isConfigured(admin: SupabaseClient): Promise<boolean> {
    const { data } = await admin.from('gmail_config').select('status').eq('id', 1).maybeSingle()
    return data?.status === 'connected'
  }

  async send({ recipients, template, context }: ChannelSendArgs): Promise<void> {
    const admin = supabaseAdmin()

    let tokens: Awaited<ReturnType<typeof getGmailTokens>>
    try {
      tokens = await getGmailTokens(admin)
    } catch (err) {
      console.error('[notifications/email] gmail token unavailable:', err)
      return
    }

    const subject = renderTemplate(template.title, context)
    const bodyText = renderTemplate(template.body, context)

    const targets = recipients.filter((r) => r.email?.includes('@'))
    await Promise.allSettled(
      targets.map((r) =>
        sendEmail(tokens.accessToken, {
          from: tokens.email,
          to: [r.email as string],
          subject,
          bodyText,
        }).catch((err) => console.error('[notifications/email] send failed:', err)),
      ),
    )
  }
}
