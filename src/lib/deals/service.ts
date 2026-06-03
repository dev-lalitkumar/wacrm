/**
 * Deal service — single source of truth for creating deals in the DB.
 *
 * Called by:
 *   • POST /api/deals  (UI form path, server-side, uses session client)
 *   • Webhook ingestion route (service-role admin client)
 *
 * Accepts any SupabaseClient so it works with both the SSR session client
 * and the service-role admin client without duplicating logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { dispatchNotification } from '@/lib/notifications/service'

export interface CreateDealInput {
  pipeline_id: string
  stage_id: string
  /** Required — caller must supply a valid source_id. Never NULL. */
  source_id: string
  /**
   * Deal title. If omitted, derived from contact info via
   * `deriveDealTitle()`. Falls back to 'New Lead'.
   */
  title?: string | null
  /** Required — every deal must belong to a contact (enforced since migration 027). */
  contact_id: string
  value?: number
  currency?: string
  /** NULL = not set; rep fills it in manually. */
  expected_close_date?: string | null
  notes?: string | null
  assigned_to?: string | null
  custom_data?: Record<string, unknown>
  /**
   * auth.users UUID of the creating user.
   * NULL for webhook/automation inserts (allowed since migration 016).
   */
  user_id?: string | null
  /**
   * Optional: contact name / phone used to derive a title when title
   * is omitted. Passed separately so the service can compute the default
   * without an extra DB query.
   */
  _contactName?: string | null
  _contactPhone?: string | null
  _fallbackTitle?: string
}

export interface CreateDealResult {
  id: string
}

/**
 * Build a human-readable deal title from available contact information.
 * Priority: contact name > contact phone > fallback string > 'New Lead'.
 */
export function deriveDealTitle(
  contactName?: string | null,
  contactPhone?: string | null,
  fallback?: string,
): string {
  if (contactName?.trim()) return `Lead — ${contactName.trim()}`
  if (contactPhone?.trim()) return `Lead — ${contactPhone.trim()}`
  return fallback ?? 'New Lead'
}

/**
 * Insert a new deal row.
 *
 * Validates that source_id, pipeline_id, and stage_id are present,
 * derives a sensible title when not supplied, then inserts and returns
 * the new row's id.
 *
 * Throws on DB error or missing required fields.
 */
export async function createDeal(
  supabase: SupabaseClient,
  data: CreateDealInput,
  opts: { notify?: boolean } = {},
): Promise<CreateDealResult> {
  const notify = opts.notify ?? true
  if (!data.contact_id) {
    throw new Error('createDeal: contact_id is required — every deal must belong to a contact')
  }
  if (!data.source_id) {
    throw new Error('createDeal: source_id is required')
  }
  if (!data.pipeline_id) {
    throw new Error('createDeal: pipeline_id is required')
  }
  if (!data.stage_id) {
    throw new Error('createDeal: stage_id is required')
  }

  const title =
    data.title?.trim() ||
    deriveDealTitle(data._contactName, data._contactPhone, data._fallbackTitle)

  const { data: row, error } = await supabase
    .from('deals')
    .insert({
      title,
      value: data.value ?? 0,
      currency: data.currency ?? 'USD',
      contact_id: data.contact_id,
      pipeline_id: data.pipeline_id,
      stage_id: data.stage_id,
      assigned_to: data.assigned_to ?? null,
      notes: data.notes ?? null,
      expected_close_date: data.expected_close_date ?? null,
      source_id: data.source_id,
      status: 'open',
      custom_data: data.custom_data ?? {},
      user_id: data.user_id ?? null,
    })
    .select('id')
    .single()

  if (error || !row) {
    throw new Error(`createDeal: insert failed — ${error?.message ?? 'unknown error'}`)
  }

  // "Welcome back" when this is a repeat deal — i.e. the contact already had at
  // least one deal before this one. Fire-and-forget; bulk paths opt out.
  if (notify) {
    const { count } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', data.contact_id)
    if ((count ?? 0) >= 2) {
      dispatchNotification({
        type: 'contact.welcome_back',
        contactId: data.contact_id,
        dealId: row.id as string,
      }).catch((err) => console.error('[createDeal] welcome_back notify', err))
    }
  }

  return { id: row.id as string }
}

/**
 * Advance a deal to its pipeline's "Proposal Sent" stage — but only when the
 * deal is open and currently *behind* that stage. Never moves a deal backwards
 * (e.g. from Negotiation) and never touches won/lost deals.
 *
 * Best-effort and idempotent: returns { changed: false } when there's nothing
 * to do (no deal, no Proposal Sent stage, already at or past it, or closed).
 * The stage write is observed by the deal_history trigger automatically.
 */
export async function advanceDealToProposalSent(
  supabase: SupabaseClient,
  dealId: string,
): Promise<{ changed: boolean; stageId?: string }> {
  const { data: deal } = await supabase
    .from('deals')
    .select('id, status, stage_id, pipeline_id')
    .eq('id', dealId)
    .maybeSingle()

  if (!deal || deal.status !== 'open') return { changed: false }

  // Resolve the target "Proposal Sent" stage in this deal's pipeline.
  const { data: target } = await supabase
    .from('pipeline_stages')
    .select('id, position')
    .eq('pipeline_id', deal.pipeline_id)
    .ilike('name', 'Proposal Sent')
    .maybeSingle()

  if (!target || target.id === deal.stage_id) return { changed: false }

  // Only advance forward — compare positions.
  const { data: current } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('id', deal.stage_id)
    .maybeSingle()

  if (current && current.position >= target.position) return { changed: false }

  const { error } = await supabase
    .from('deals')
    .update({ stage_id: target.id, updated_at: new Date().toISOString() })
    .eq('id', deal.id)

  if (error) return { changed: false }
  return { changed: true, stageId: target.id as string }
}
