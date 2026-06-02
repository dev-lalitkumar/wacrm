/**
 * Template rendering + placeholder context resolution.
 *
 * `buildContext` fetches the entity data for an event once (shared by all
 * recipients and channels) and returns a flat string map. `renderTemplate`
 * substitutes `{{placeholder}}` tokens. Unknown placeholders render empty.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationEvent, PlaceholderContext, EntityType } from './types'

export function renderTemplate(template: string, ctx: PlaceholderContext): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => ctx[key] ?? '')
}

function formatMoney(value: unknown, currency: unknown): string {
  if (value == null || value === '') return ''
  const cur = typeof currency === 'string' && currency ? `${currency} ` : ''
  return `${cur}${value}`.trim()
}

/** Narrow a Supabase embedded relation that may come back as object or array. */
function one<T>(rel: unknown): T | null {
  if (Array.isArray(rel)) return (rel[0] as T) ?? null
  return (rel as T) ?? null
}

async function profileName(admin: SupabaseClient, profileId?: string | null): Promise<string> {
  if (!profileId) return ''
  const { data } = await admin.from('profiles').select('full_name').eq('id', profileId).single()
  return data?.full_name ?? ''
}

export async function buildContext(
  event: NotificationEvent,
  admin: SupabaseClient,
): Promise<PlaceholderContext> {
  const ctx: PlaceholderContext = {}

  switch (event.type) {
    case 'contact.assigned': {
      const { data: contact } = await admin
        .from('contacts').select('name, phone').eq('id', event.contactId).single()
      ctx.contact_name = contact?.name ?? 'Unknown'
      ctx.contact_phone = contact?.phone ?? ''
      ctx.assignee_name = await profileName(admin, event.assigneeProfileId)
      ctx.assigner_name = (await profileName(admin, event.assignerProfileId)) || 'System'
      break
    }

    case 'contact.created_from_meta': {
      const { data: contact } = await admin
        .from('contacts').select('name, phone, email').eq('id', event.contactId).single()
      ctx.contact_name = contact?.name ?? 'Unknown'
      ctx.contact_phone = contact?.phone ?? ''
      ctx.contact_email = contact?.email ?? ''
      break
    }

    case 'deal.created':
    case 'deal.assigned':
    case 'deal.closed_won':
    case 'deal.closed_lost': {
      const { data: deal } = await admin
        .from('deals')
        .select('title, value, currency, assigned_to, contact:contacts(name, phone)')
        .eq('id', event.dealId).single()
      const contact = one<{ name: string }>(deal?.contact)
      ctx.deal_title = deal?.title ?? 'Untitled deal'
      ctx.deal_value = formatMoney(deal?.value, deal?.currency)
      ctx.contact_name = contact?.name ?? ''
      ctx.assignee_name = await profileName(admin, deal?.assigned_to)
      ctx.assigner_name =
        (await profileName(admin, (event as { assignerProfileId?: string | null }).assignerProfileId)) || 'System'
      break
    }

    case 'deal.stage_changed': {
      const { data: deal } = await admin
        .from('deals')
        .select('title, assigned_to, contact:contacts(name)')
        .eq('id', event.dealId).single()
      const { data: stage } = await admin
        .from('pipeline_stages').select('name').eq('id', event.stageId).single()
      const contact = one<{ name: string }>(deal?.contact)
      ctx.deal_title = deal?.title ?? 'Untitled deal'
      ctx.stage_name = stage?.name ?? ''
      ctx.contact_name = contact?.name ?? ''
      ctx.assignee_name = await profileName(admin, deal?.assigned_to)
      break
    }

    case 'reminder.due_today':
    case 'reminder.overdue': {
      const table = event.entityType === 'deal' ? 'deals' : 'contacts'
      const nameCol = event.entityType === 'deal' ? 'title' : 'name'
      const { data: entity } = await admin
        .from(table)
        .select(`${nameCol}, reminder_type, reminder_note, reminder_at`)
        .eq('id', event.entityId).single()
      const e = entity as {
        title?: string; name?: string; reminder_type?: string
        reminder_note?: string; reminder_at?: string
      } | null
      ctx.entity_name = e?.title ?? e?.name ?? ''
      ctx.reminder_type = e?.reminder_type ?? 'reminder'
      ctx.reminder_note = e?.reminder_note ?? 'No note'
      ctx.assignee_name = await profileName(admin, event.assigneeProfileId)
      if (event.type === 'reminder.overdue' && e?.reminder_at) {
        const days = Math.floor((Date.now() - new Date(e.reminder_at).getTime()) / 86_400_000)
        ctx.days_overdue = String(Math.max(1, days))
      }
      break
    }

    case 'proposal.viewed':
    case 'proposal.accepted':
    case 'proposal.rejected': {
      const { data: proposal } = await admin
        .from('proposals')
        .select('title, total_amount, currency, contact:contacts(name)')
        .eq('id', event.proposalId).single()
      const contact = one<{ name: string }>(proposal?.contact)
      ctx.proposal_title = proposal?.title ?? 'Untitled proposal'
      ctx.proposal_value = formatMoney(proposal?.total_amount, proposal?.currency)
      ctx.contact_name = contact?.name ?? ''
      break
    }

    case 'conversation.assigned': {
      const { data: conv } = await admin
        .from('conversations')
        .select('contact:contacts(name, phone)')
        .eq('id', event.conversationId).single()
      const contact = one<{ name: string; phone: string }>(conv?.contact)
      ctx.contact_name = contact?.name ?? ''
      ctx.contact_phone = contact?.phone ?? ''
      ctx.agent_name = await profileName(admin, event.agentProfileId)
      break
    }
  }

  return ctx
}

/** Entity type + id used for in-app navigation. */
export function resolveEntity(event: NotificationEvent): { entityType: EntityType; entityId: string | null } {
  switch (event.type) {
    case 'contact.assigned':
    case 'contact.created_from_meta':
      return { entityType: 'contact', entityId: event.contactId }
    case 'deal.created':
    case 'deal.assigned':
    case 'deal.stage_changed':
    case 'deal.closed_won':
    case 'deal.closed_lost':
      return { entityType: 'deal', entityId: event.dealId }
    case 'reminder.due_today':
    case 'reminder.overdue':
      return { entityType: event.entityType, entityId: event.entityId }
    case 'proposal.viewed':
    case 'proposal.accepted':
    case 'proposal.rejected':
      return { entityType: 'proposal', entityId: event.proposalId }
    case 'conversation.assigned':
      return { entityType: 'conversation', entityId: event.conversationId }
  }
}
