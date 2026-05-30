export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
  /**
   * Opted-in beta feature keys for this account. The column survives
   * for future beta gates; no current feature reads it (Flows was
   * the last user and went to soft-GA in PR #134). Defaults to `[]`
   * for every profile; toggled per-account via a direct UPDATE on
   * the `profiles` row.
   */
  beta_features?: string[];
  /**
   * Set false by /api/users/[id] DELETE (soft-delete). Inactive
   * profiles can sign in but RLS refuses every helper that requires
   * `is_active = TRUE`. Added in migration 013.
   */
  is_active?: boolean;
  /**
   * True when an Admin/Owner provisioned the account or just reset
   * the user's password — the dashboard layout forces the user
   * through /change-password until this clears. Added in 013.
   */
  must_change_password?: boolean;
  /** auth.users.id of the Admin/Owner who created this profile. */
  created_by?: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  /** auth.users.id of whoever first inserted the row (audit). */
  user_id: string;
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  avatar_url?: string;
  /**
   * profiles.id of the team member responsible for the contact. RLS
   * uses this to scope Executives to "their" contacts. Added in 013.
   */
  assigned_to?: string | null;
  /** JSONB bag of custom field values keyed by custom_field_id. Added in 014. */
  custom_data?: Record<string, unknown>;
  /** FK to sources.id — backfilled to Direct on migration 015. */
  source_id?: string | null;
  /** Embedded source row when loaded via nested join. */
  source?: Source;
  /** Active reminder fields — same pattern as deals. Added in 028. */
  reminder_type?: DealReminderType;
  reminder_at?: string;
  reminder_note?: string;
  reminder_updated_at?: string;
  /** Embedded contact_tags with tag relation — present when loaded via nested join. */
  contact_tags?: Array<{ tag: Tag }>;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
}

export type CustomFieldType = 'text' | 'number' | 'select' | 'multi_select' | 'file';

export interface CustomField {
  id: string;
  user_id: string;
  field_name: string;
  field_type: CustomFieldType;
  field_options?: { options?: string[] } & Record<string, unknown>;
  applies_to: 'contact' | 'deal';
  sort_order: number;
  created_at: string;
}

export interface ContactCustomValue {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value?: string;
}

export type FollowupChannel = 'whatsapp' | 'call' | 'email' | 'meeting' | 'other';
export type DealReminderType = 'followup' | 'call' | 'meeting' | 'other';

/**
 * Unified followup record (migration 027).
 * Every followup belongs to a contact; optionally linked to a deal.
 */
export interface Followup {
  id: string;
  contact_id: string;
  deal_id?: string | null;
  channel: FollowupChannel;
  note: string;
  created_by: string;
  created_at: string;
  creator?: Profile;
  // Call Center metadata (migration 026)
  call_log_id?: string | null;
  recording_url?: string | null;
  call_duration?: number | null;
}

/** @deprecated Use {@link Followup} instead — kept for backward compat during migration. */
export type DealFollowup = Followup;
/** @deprecated Use {@link Followup} instead — kept for backward compat during migration. */
export type ContactFollowup = Followup;

export interface ContactNote {
  id: string;
  contact_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
}

export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface Conversation {
  id: string;
  user_id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export type SenderType = 'customer' | 'agent' | 'bot';
export type ContentType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'template'
  /** Customer tapped a reply button or list row on a message we sent. */
  | 'interactive';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id?: string;
  content_type: ContentType;
  content_text?: string;
  media_url?: string;
  template_name?: string;
  message_id?: string;
  status: MessageStatus;
  created_at: string;
  reply_to_message_id?: string;
  /**
   * Only set when `content_type === 'interactive'` — the stable id of
   * the button or list row the customer tapped. The Flows engine uses
   * this to route the next node; the inbox bubble uses it as a styling
   * cue (renders with a "↩ button reply" affordance).
   */
  interactive_reply_id?: string;
}

export type ReactionActor = 'customer' | 'agent';

export interface MessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  actor_type: ReactionActor;
  actor_id?: string;
  emoji: string;
  created_at: string;
}

// ============================================================
// Gmail Integration (migration 020)
// ============================================================

/** Singleton Gmail config — id is always 1. */
export interface GmailConfig {
  id: number;
  connected_email: string | null;
  status: 'connected' | 'disconnected' | 'error';
  scopes: string[] | null;
  connected_at: string | null;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  from_email: string;
  to_emails: string[];
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  contact_id: string | null;
  deal_id: string | null;
  sent_by: string;
  status: 'sending' | 'sent' | 'failed' | 'bounced';
  error_message: string | null;
  created_at: string;
}

export interface EmailNotification {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  snippet: string | null;
  contact_id: string | null;
  is_read: boolean;
  received_at: string;
  contact?: Contact;
}

export interface WhatsAppConfig {
  id: string;
  user_id: string;
  phone_number_id: string;
  waba_id?: string;
  access_token: string;
  verify_token?: string;
  status: 'connected' | 'disconnected';
  connected_at?: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  category: 'Marketing' | 'Utility' | 'Authentication';
  language?: string;
  header_type?: 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: Record<string, unknown>[];
  status?: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface Pipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
}

export type DealStatus = 'open' | 'won' | 'lost';

/** Singleton company entity — id is always 1 (migration 019). */
export interface Company {
  id: number;
  name: string;
  logo_url?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  updated_at: string;
}

/** Lost reason master — seeded with 5 system defaults in migration 018. */
export interface LostReason {
  id: string;
  reason: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface Deal {
  id: string;
  user_id: string;
  pipeline_id: string;
  stage_id: string;
  /**
   * Required since migration 027 — every deal must belong to a contact.
   * ON DELETE RESTRICT prevents deleting a contact that still has deals.
   */
  contact_id: string;
  conversation_id?: string;
  assigned_to?: string;
  title: string;
  value: number;
  currency?: string;
  notes?: string;
  expected_close_date?: string;
  status?: DealStatus;
  /** Active reminder fields — auto-seeded by DB trigger on open deal insert. Added in 014. */
  reminder_type?: DealReminderType;
  reminder_at?: string;
  reminder_note?: string;
  reminder_updated_at?: string;
  /** JSONB bag of custom field values keyed by custom_field_id. Added in 014. */
  custom_data?: Record<string, unknown>;
  /** FK to sources.id — backfilled to Direct on migration 015. */
  source_id?: string | null;
  /** Embedded source row when loaded via nested join. */
  source?: Source;
  /** FK to lost_reasons.id — required when status='lost' (migration 018). */
  lost_reason_id?: string | null;
  /** Embedded lost reason when loaded via nested join. */
  lost_reason?: LostReason;
  /** When the deal was closed (won/lost). Auto-set by trigger, cleared on reopen. Migration 022. */
  closed_at?: string | null;
  /** Profile ID of the user who closed the deal. Cleared on reopen. Migration 022. */
  closed_by?: string | null;
  /** Embedded closer profile when loaded via nested join. */
  closer?: Profile;
  created_at: string;
  updated_at?: string;
  contact?: Contact;
  stage?: PipelineStage;
  assignee?: Profile;
}

export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed';

export interface Broadcast {
  id: string;
  user_id: string;
  name: string;
  template_name: string;
  template_language: string;
  template_variables?: Record<string, unknown>;
  audience_filter?: Record<string, unknown>;
  scheduled_at?: string;
  status: BroadcastStatus;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  created_at: string;
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  /**
   * Nullable after migration 004 — becomes NULL when the referenced
   * contact is deleted (ON DELETE SET NULL). History preserved; the
   * UI renders "Unknown" for orphaned rows.
   */
  contact_id: string | null;
  status: RecipientStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  replied_at?: string;
  error_message?: string;
  /**
   * Meta's message id, persisted when the broadcast send succeeds so
   * the webhook can mirror status updates back onto the recipient row.
   * Added in migration 003.
   */
  whatsapp_message_id?: string;
  created_at: string;
  contact?: Contact;
}

// ============================================================
// Automations (migration 006)
// ============================================================

export type AutomationTriggerType =
  | 'new_message_received'
  | 'first_inbound_message'
  | 'keyword_match'
  | 'new_contact_created'
  | 'conversation_assigned'
  | 'tag_added'
  | 'time_based';

export type AutomationStepType =
  | 'send_message'
  | 'send_template'
  | 'add_tag'
  | 'remove_tag'
  | 'assign_conversation'
  | 'update_contact_field'
  | 'create_deal'
  | 'wait'
  | 'condition'
  | 'send_webhook'
  | 'close_conversation';

export type AutomationLogStatus = 'success' | 'partial' | 'failed';

export interface KeywordMatchTriggerConfig {
  keywords: string[];
  match_type: 'exact' | 'contains';
  case_sensitive?: boolean;
}

export interface TagTriggerConfig {
  tag_id: string;
}

export interface TimeBasedTriggerConfig {
  /** Cron expression or simple HH:mm string; engine can accept either. */
  schedule: string;
  timezone?: string;
}

export type AutomationTriggerConfig =
  | Record<string, never>
  | KeywordMatchTriggerConfig
  | TagTriggerConfig
  | TimeBasedTriggerConfig
  | Record<string, unknown>;

export interface SendMessageStepConfig {
  text: string;
}

export interface SendTemplateStepConfig {
  template_name: string;
  language?: string;
  variables?: Record<string, string>;
}

export interface TagStepConfig {
  tag_id: string;
}

export interface AssignConversationStepConfig {
  mode: 'specific' | 'round_robin';
  agent_id?: string;
}

export interface UpdateContactFieldStepConfig {
  field: string;
  value: string;
}

export interface CreateDealStepConfig {
  pipeline_id: string;
  stage_id: string;
  title: string;
  value?: number;
}

export interface WaitStepConfig {
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
}

export type ConditionSubject =
  | 'contact_field'
  | 'tag_presence'
  | 'message_content'
  | 'time_of_day';

export interface ConditionStepConfig {
  subject: ConditionSubject;
  /** e.g. field name, tag id, substring, or "HH:mm-HH:mm" depending on subject */
  operand?: string;
  /** For contact_field equals / message_content contains — comparison value */
  value?: string;
}

export interface SendWebhookStepConfig {
  url: string;
  headers?: Record<string, string>;
  body_template?: string;
}

export type AutomationStepConfig =
  | SendMessageStepConfig
  | SendTemplateStepConfig
  | TagStepConfig
  | AssignConversationStepConfig
  | UpdateContactFieldStepConfig
  | CreateDealStepConfig
  | WaitStepConfig
  | ConditionStepConfig
  | SendWebhookStepConfig
  | Record<string, never>
  | Record<string, unknown>;

export interface Automation {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  trigger_type: AutomationTriggerType;
  trigger_config: AutomationTriggerConfig;
  is_active: boolean;
  execution_count: number;
  last_executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationStep {
  id: string;
  automation_id: string;
  parent_step_id?: string | null;
  branch?: 'yes' | 'no' | null;
  step_type: AutomationStepType;
  step_config: AutomationStepConfig;
  position: number;
  created_at: string;
}

export interface AutomationLogStepResult {
  step_id: string;
  step_type: AutomationStepType;
  status: 'success' | 'skipped' | 'failed';
  detail?: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  user_id: string;
  contact_id: string | null;
  trigger_event: string;
  steps_executed: AutomationLogStepResult[];
  status: AutomationLogStatus;
  error_message?: string | null;
  created_at: string;
  contact?: Contact;
}

// ============================================================
// Integrations — Sources + Webhooks (migration 015)
// ============================================================

export interface Source {
  id: string;
  name: string;
  /** Machine-friendly slug; immutable for system rows. */
  key: string;
  /** True for Direct + WhatsApp; cannot be deleted or have key/flag changed. */
  is_system: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at: string;
}

export interface RoundRobinConfig {
  id: number;
  enabled: boolean;
  /** Profile IDs in the rotation. */
  member_ids: string[];
  /** Rotation cursor; -1 means next pick will be index 0. */
  last_index: number;
  updated_by?: string | null;
  updated_at: string;
}

/**
 * Field mapping shape stored on `webhooks.field_mappings`.
 *
 * Keys under `contact`:
 *   - "name" | "phone" | "email" | "company"  → standard contact columns
 *   - "cf:<custom_field_id>"                  → contact custom_data slot
 * Keys under `deal`:
 *   - "title" | "value" | "notes" | "expected_close_date" → standard deal columns
 *   - "cf:<custom_field_id>"                              → deal custom_data slot
 *
 * Values are dot-notation paths into the incoming JSON payload
 * (e.g. "fields.full_name" → payload.fields.full_name). Blank/empty
 * mapping values are stripped on save.
 */
export interface WebhookFieldMappings {
  contact?: Record<string, string>;
  deal?: Record<string, string>;
}

export type WebhookRequestStatus =
  | 'ok'
  | 'rate_limited'
  | 'invalid_secret'
  | 'bad_payload'
  | 'disabled'
  | 'error';

export interface Webhook {
  id: string;
  name: string;
  source_id: string;
  /** AES-GCM ciphertext of the raw secret; never sent to the browser. */
  secret_encrypted: string;
  /** First 8 chars of raw secret, safe to display alongside masked tail. */
  secret_prefix: string;
  is_active: boolean;

  creates_deal: boolean;
  pipeline_id?: string | null;
  stage_id?: string | null;

  field_mappings: WebhookFieldMappings;

  round_robin_override: boolean;
  round_robin_member_ids: string[];
  round_robin_last_index: number;

  rate_limit_per_minute: number;

  created_by?: string | null;
  created_at: string;
  updated_at: string;

  /** Embedded when loaded via nested join. */
  source?: Source;
  pipeline?: Pipeline;
  stage?: PipelineStage;
}

export interface WebhookRequest {
  id: string;
  webhook_id: string;
  received_at: string;
  ip_address?: string | null;
  status: WebhookRequestStatus;
  error_message?: string | null;
  payload_preview?: string | null;
  created_contact_id?: string | null;
  created_deal_id?: string | null;
}

// ============================================================
// Catalog & Proposals (migration 023)
// ============================================================

export interface CatalogItem {
  id: string;
  user_id?: string | null;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  unit: string;
  category?: string | null;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DealCatalogItem {
  id: string;
  deal_id: string;
  catalog_item_id?: string | null;
  name: string;
  quantity: number;
  notes?: string | null;
  created_at: string;
  catalog_item?: CatalogItem;
}

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected';

export interface Proposal {
  id: string;
  user_id?: string | null;
  deal_id?: string | null;
  contact_id?: string | null;
  proposal_number: string;
  title: string;
  status: ProposalStatus;
  valid_until?: string | null;
  notes?: string | null;
  terms?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  total_amount: number;
  currency: string;
  public_token: string;
  created_by?: string | null;
  sent_at?: string | null;
  sent_by?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  deal?: Deal;
  items?: ProposalItem[];
  history?: ProposalHistory[];
}

export interface ProposalItem {
  id: string;
  proposal_id: string;
  catalog_item_id?: string | null;
  name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  total: number;
  sort_order: number;
}

export interface ProposalTemplate {
  id: string;
  user_id?: string | null;
  channel: 'email' | 'whatsapp';
  name: string;
  subject?: string | null;
  body: string;
  is_default: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalHistory {
  id: string;
  proposal_id: string;
  action: string;
  channel?: string | null;
  actor_id?: string | null;
  recipient?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  actor?: Profile;
}
