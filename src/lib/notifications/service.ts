/**
 * Notification dispatch — the single entry point for emitting notifications.
 *
 * Call `dispatchNotification(event)` fire-and-forget from API routes / cron
 * after the primary write succeeds. It never throws: every failure is caught
 * and logged so notification problems can't break the originating request.
 *
 *   dispatchNotification(event)
 *     → resolveRecipients(event)        who to notify (profile_id + email + phone)
 *     → buildContext(event)             fetch entity data → placeholder map
 *     → for each channel:
 *         if isConfigured && active template exists → channel.send(...)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { buildContext, resolveEntity } from './template-engine'
import { InAppChannel } from './channels/in-app'
import { EmailChannel } from './channels/email'
import { WhatsAppChannel } from './channels/whatsapp'
import type {
  NotificationChannel,
  NotificationEvent,
  NotificationRecipient,
  NotificationTemplate,
} from './types'

const CHANNELS: NotificationChannel[] = [
  new InAppChannel(),
  new EmailChannel(),
  new WhatsAppChannel(),
]

export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  try {
    const admin = supabaseAdmin()

    const recipients = await resolveRecipients(event, admin)
    if (!recipients.length) return

    const context = await buildContext(event, admin)
    const { entityType, entityId } = resolveEntity(event)

    // Load all active templates for this event in one query, keyed by channel.
    const { data: templates } = await admin
      .from('notification_templates')
      .select('*')
      .eq('event_type', event.type)
      .eq('is_active', true)
    const byChannel = new Map<string, NotificationTemplate>()
    for (const t of (templates ?? []) as NotificationTemplate[]) {
      if (!byChannel.has(t.channel)) byChannel.set(t.channel, t)
    }

    await Promise.all(
      CHANNELS.map(async (channel) => {
        const template = byChannel.get(channel.name)
        if (!template) return
        try {
          if (!(await channel.isConfigured(admin))) return
          await channel.send({ event, recipients, template, context, entityType, entityId })
        } catch (err) {
          console.error(`[notifications/${channel.name}]`, err)
        }
      }),
    )
  } catch (err) {
    console.error('[notifications] dispatch failed:', err)
  }
}

async function getRecipient(
  admin: SupabaseClient,
  profileId: string,
): Promise<NotificationRecipient[]> {
  const { data } = await admin
    .from('profiles')
    .select('id, email, phone, is_active')
    .eq('id', profileId)
    .maybeSingle()
  if (!data || data.is_active === false) return []
  return [{ profileId: data.id, email: data.email, phone: data.phone }]
}

async function resolveRecipients(
  event: NotificationEvent,
  admin: SupabaseClient,
): Promise<NotificationRecipient[]> {
  switch (event.type) {
    case 'contact.assigned':
    case 'deal.created':
    case 'deal.assigned':
      return getRecipient(admin, event.assigneeProfileId)

    case 'reminder.due_today':
    case 'reminder.overdue':
      return getRecipient(admin, event.assigneeProfileId)

    case 'proposal.viewed':
    case 'proposal.accepted':
    case 'proposal.rejected':
      return getRecipient(admin, event.notifyProfileId)

    case 'conversation.assigned':
      return getRecipient(admin, event.agentProfileId)

    case 'deal.stage_changed':
    case 'deal.closed_won':
    case 'deal.closed_lost': {
      const { data: deal } = await admin
        .from('deals').select('assigned_to').eq('id', event.dealId).maybeSingle()
      if (!deal?.assigned_to) return []
      return getRecipient(admin, deal.assigned_to)
    }

    case 'contact.welcome':
    case 'contact.welcome_back': {
      // Sent TO the contact themselves — resolve their email + phone.
      const { data: contact } = await admin
        .from('contacts')
        .select('email, phone')
        .eq('id', event.contactId)
        .maybeSingle()
      if (!contact || (!contact.email && !contact.phone)) return []
      return [{ profileId: null, email: contact.email, phone: contact.phone }]
    }

    default:
      return []
  }
}
