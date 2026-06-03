/**
 * Unified notification event system — shared types.
 *
 * A business event is described by a `NotificationEvent` (a discriminated
 * union). The service resolves recipients, fills placeholders, and routes
 * through every configured channel. Terminology is "deal" and "contact"
 * throughout — there is no "lead" entity.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Event union ──────────────────────────────────────────────────
export type NotificationEvent =
  | { type: 'contact.assigned';          contactId: string; assigneeProfileId: string; assignerProfileId?: string | null }
  | { type: 'contact.welcome';           contactId: string }
  | { type: 'contact.welcome_back';      contactId: string; dealId?: string }
  | { type: 'deal.created';              dealId: string; assigneeProfileId: string }
  | { type: 'deal.assigned';             dealId: string; assigneeProfileId: string; assignerProfileId?: string | null }
  | { type: 'deal.stage_changed';        dealId: string; stageId: string }
  | { type: 'deal.closed_won';           dealId: string }
  | { type: 'deal.closed_lost';          dealId: string }
  | { type: 'reminder.due_today';        entityType: 'deal' | 'contact'; entityId: string; assigneeProfileId: string }
  | { type: 'reminder.overdue';          entityType: 'deal' | 'contact'; entityId: string; assigneeProfileId: string }
  | { type: 'proposal.viewed';           proposalId: string; notifyProfileId: string }
  | { type: 'proposal.accepted';         proposalId: string; notifyProfileId: string }
  | { type: 'proposal.rejected';         proposalId: string; notifyProfileId: string }
  | { type: 'conversation.assigned';     conversationId: string; agentProfileId: string }

export type NotificationEventType = NotificationEvent['type']

/** The list of every known event type — used by the templates UI. */
export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  'contact.assigned',
  'contact.welcome',
  'contact.welcome_back',
  'deal.created',
  'deal.assigned',
  'deal.stage_changed',
  'deal.closed_won',
  'deal.closed_lost',
  'reminder.due_today',
  'reminder.overdue',
  'proposal.viewed',
  'proposal.accepted',
  'proposal.rejected',
  'conversation.assigned',
]

/** Placeholders available per event type — surfaced in the settings UI. */
export const EVENT_PLACEHOLDERS: Record<NotificationEventType, string[]> = {
  'contact.assigned': ['contact_name', 'contact_phone', 'assignee_name', 'assigner_name'],
  'contact.welcome': ['contact_name', 'contact_phone', 'contact_email', 'company'],
  'contact.welcome_back': ['contact_name', 'deal_title', 'deal_value'],
  'deal.created': ['deal_title', 'contact_name', 'deal_value', 'assignee_name'],
  'deal.assigned': ['deal_title', 'contact_name', 'assignee_name', 'assigner_name'],
  'deal.stage_changed': ['deal_title', 'contact_name', 'stage_name', 'assignee_name'],
  'deal.closed_won': ['deal_title', 'contact_name', 'deal_value', 'assignee_name'],
  'deal.closed_lost': ['deal_title', 'contact_name', 'assignee_name'],
  'reminder.due_today': ['entity_name', 'reminder_type', 'reminder_note', 'assignee_name'],
  'reminder.overdue': ['entity_name', 'reminder_type', 'reminder_note', 'days_overdue', 'assignee_name'],
  'proposal.viewed': ['proposal_title', 'contact_name', 'proposal_value'],
  'proposal.accepted': ['proposal_title', 'contact_name', 'proposal_value'],
  'proposal.rejected': ['proposal_title', 'contact_name'],
  'conversation.assigned': ['contact_name', 'contact_phone', 'agent_name'],
}

/**
 * Who each notification is delivered to:
 *   'user'    — an internal team member (profile-based; in-app/email/whatsapp)
 *   'contact' — the lead/customer themselves (email/whatsapp only)
 * Surfaced as a To User / To Contact badge in the settings UI.
 */
export type NotificationTarget = 'user' | 'contact'

export const EVENT_TARGETS: Record<NotificationEventType, NotificationTarget> = {
  'contact.assigned': 'user',
  'contact.welcome': 'contact',
  'contact.welcome_back': 'contact',
  'deal.created': 'user',
  'deal.assigned': 'user',
  'deal.stage_changed': 'user',
  'deal.closed_won': 'user',
  'deal.closed_lost': 'user',
  'reminder.due_today': 'user',
  'reminder.overdue': 'user',
  'proposal.viewed': 'user',
  'proposal.accepted': 'user',
  'proposal.rejected': 'user',
  'conversation.assigned': 'user',
}

// ── Records ──────────────────────────────────────────────────────
export type NotificationChannelName = 'in_app' | 'email' | 'whatsapp'
export type EntityType = 'contact' | 'deal' | 'proposal' | 'conversation' | null

export type PlaceholderContext = Record<string, string>

export interface NotificationRecord {
  id: string
  profile_id: string
  type: string
  title: string
  body: string
  entity_type: EntityType
  entity_id: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationTemplate {
  id: string
  event_type: string
  channel: NotificationChannelName
  name: string
  title: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationRecipient {
  /** Null for contact-targeted events (the recipient is the lead, not a profile). */
  profileId: string | null
  email: string | null
  phone: string | null
}

export interface ChannelSendArgs {
  event: NotificationEvent
  recipients: NotificationRecipient[]
  template: NotificationTemplate
  context: PlaceholderContext
  entityType: EntityType
  entityId: string | null
}

export interface NotificationChannel {
  name: NotificationChannelName
  /** Whether the underlying integration is set up. In-app is always true. */
  isConfigured(admin: SupabaseClient): Promise<boolean>
  send(args: ChannelSendArgs): Promise<void>
}
