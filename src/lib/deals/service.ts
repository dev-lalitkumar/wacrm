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
): Promise<CreateDealResult> {
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

  return { id: row.id as string }
}
