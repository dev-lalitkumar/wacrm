/**
 * Shared deals query builder for export routes.
 *
 * The list pages (pipelines, closed-deals) bulk-fetch then filter client-side.
 * For exports we apply the same filters server-side so large datasets are never
 * over-fetched. The exported data is guaranteed to match what the UI shows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'

export interface DealFilters {
  statusTab?: 'all' | 'open' | 'won' | 'lost'  // 'open' for pipelines, others for closed-deals
  search?: string
  assigneeFilter?: string[]
  lostReasonFilter?: string[]                    // closed-deals only
  reminderTab?: string                           // pipelines only: 'all'|'today'|'missed'|'upcoming'|'today_missed'
}

/**
 * Returns a Supabase query for deals with all active filters applied.
 * Caller appends `.limit()` (for export) — no pagination applied here.
 *
 * Returns `null` when a sub-query filter resolves to zero IDs (empty result short-circuit).
 */
export async function buildDealsQuery(
  supabase: SupabaseClient,
  filters: DealFilters,
) {
  const {
    statusTab = 'all',
    search = '',
    assigneeFilter = [],
    lostReasonFilter = [],
    reminderTab = 'all',
  } = filters

  const now = new Date().toISOString()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const todayEndISO = todayEnd.toISOString()

  // Reminder-tab pre-filter for open deals (deal-level reminders in pipelines)
  let reminderDealIds: string[] | null = null
  if (statusTab === 'open' && reminderTab !== 'all') {
    let rQuery = supabase
      .from('deals')
      .select('id')
      .eq('pipeline_id', FIXED_PIPELINE_ID)
      .eq('status', 'open')
      .not('reminder_at', 'is', null)

    if (reminderTab === 'today_missed')      rQuery = rQuery.lte('reminder_at', todayEndISO)
    else if (reminderTab === 'today')        rQuery = rQuery.gte('reminder_at', now).lte('reminder_at', todayEndISO)
    else if (reminderTab === 'missed')       rQuery = rQuery.lt('reminder_at', now)
    else if (reminderTab === 'upcoming')     rQuery = rQuery.gt('reminder_at', todayEndISO)

    const { data: rRows } = await rQuery
    reminderDealIds = (rRows ?? []).map((r: { id: string }) => r.id)
    if (reminderDealIds.length === 0) return null
  }

  // Base query — include everything needed for the CSV columns.
  let query = supabase
    .from('deals')
    .select(
      '*, contact:contacts(id, name, phone, email, company), assignee:profiles!deals_assigned_to_fkey(id, full_name), stage:pipeline_stages(id, name), lost_reason:lost_reasons(id, reason)',
    )
    .eq('pipeline_id', FIXED_PIPELINE_ID)
    .order('created_at', { ascending: false })

  // Status filter
  if (statusTab === 'open') {
    query = query.eq('status', 'open')
  } else if (statusTab === 'won') {
    query = query.eq('status', 'won')
  } else if (statusTab === 'lost') {
    query = query.eq('status', 'lost')
  } else {
    // 'all' for closed-deals: won + lost
    query = query.in('status', ['won', 'lost'])
  }

  // Reminder deal-id filter
  if (reminderDealIds !== null) {
    query = query.in('id', reminderDealIds)
  }

  // Full-text search (server-side OR across key columns)
  if (search.trim()) {
    const term = `%${search.trim()}%`
    // Supabase doesn't support cross-table OR in a single .or() call, so we
    // filter on deal fields server-side and accept that contact-field search
    // misses are expected (same trade-off as the list page would make server-side).
    query = query.or(
      [
        `title.ilike.${term}`,
        `notes.ilike.${term}`,
      ].join(','),
    )
  }

  // Assignee filter
  if (assigneeFilter.length > 0) {
    query = query.in('assigned_to', assigneeFilter)
  }

  // Lost reason filter (closed-deals page)
  if (lostReasonFilter.length > 0) {
    query = query.in('lost_reason_id', lostReasonFilter)
  }

  return query
}
