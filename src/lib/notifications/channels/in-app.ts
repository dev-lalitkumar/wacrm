/**
 * In-app channel — always active. Inserts a row per recipient into the
 * `notifications` table; Supabase Realtime delivers it to the browser.
 */

import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { renderTemplate } from '../template-engine'
import type { ChannelSendArgs, NotificationChannel } from '../types'

export class InAppChannel implements NotificationChannel {
  name = 'in_app' as const

  async isConfigured(): Promise<boolean> {
    return true
  }

  async send({ event, recipients, template, context, entityType, entityId }: ChannelSendArgs): Promise<void> {
    // In-app notifications are profile-scoped. Contact-targeted events have no
    // profile recipient, so there's nothing to insert.
    const profileRecipients = recipients.filter((r) => r.profileId)
    if (!profileRecipients.length) return
    const admin = supabaseAdmin()
    const title = renderTemplate(template.title, context)
    const body = renderTemplate(template.body, context)

    const rows = profileRecipients.map((r) => ({
      profile_id: r.profileId,
      type: event.type,
      title,
      body,
      entity_type: entityType,
      entity_id: entityId,
      metadata: event as Record<string, unknown>,
    }))

    const { error } = await admin.from('notifications').insert(rows)
    if (error) throw error
  }
}
