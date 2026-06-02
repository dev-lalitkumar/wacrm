/**
 * Shared contacts query builder.
 *
 * Both the contacts list page (which appends .range() for pagination) and
 * the export API route (which appends .limit()) call this function so the
 * filter logic is **never duplicated**. Same filters → same rows, always.
 *
 * The function is async because the reminder-tab filter requires a
 * sub-query to look up deal contact IDs first.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ContactFilters {
  search?: string
  assigneeFilter?: string[]
  reminderTab?: string        // 'all' | 'today' | 'missed' | 'upcoming' | 'today_missed'
  tagIds?: string[]           // contacts must have ALL of these tags
  activeFilters?: Record<string, string[]>   // custom field filters keyed by field ID
  filterFields?: Array<{ id: string; field_type: string }> // field definitions for custom filters
  customTextFields?: Array<{ id: string }> // text/number fields used in search
}

/**
 * Returns a Supabase query for contacts with all active filters applied.
 * The caller must append `.range()` (for pagination) or `.limit()` (for export).
 *
 * Returns `null` when the reminder-tab filter resolves to zero contacts
 * (so the caller can short-circuit and return an empty result).
 */
export async function buildContactsQuery(
  supabase: SupabaseClient,
  filters: ContactFilters,
) {
  const {
    search = '',
    assigneeFilter = [],
    reminderTab = 'all',
    tagIds = [],
    activeFilters = {},
    filterFields = [],
    customTextFields = [],
  } = filters

  const now = new Date().toISOString()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const todayEndISO = todayEnd.toISOString()

  // Reminder-tab pre-filter: resolve matching contact IDs via sub-query.
  let reminderContactIds: string[] | null = null
  if (reminderTab !== 'all') {
    let dealQuery = supabase
      .from('deals')
      .select('contact_id')
      .eq('status', 'open')
      .not('contact_id', 'is', null)

    if (reminderTab === 'today_missed')      dealQuery = dealQuery.lte('reminder_at', todayEndISO)
    else if (reminderTab === 'today')        dealQuery = dealQuery.gte('reminder_at', now).lte('reminder_at', todayEndISO)
    else if (reminderTab === 'missed')       dealQuery = dealQuery.lt('reminder_at', now)
    else if (reminderTab === 'upcoming')     dealQuery = dealQuery.gt('reminder_at', todayEndISO)

    const { data: dealRows } = await dealQuery
    reminderContactIds = [
      ...new Set(
        (dealRows ?? []).map((r: { contact_id: string }) => r.contact_id).filter(Boolean),
      ),
    ]
    if (reminderContactIds.length === 0) return null
  }

  // Tag filter pre-query: contacts must have all selected tags.
  let tagContactIds: string[] | null = null
  if (tagIds.length > 0) {
    const { data: tagRows } = await supabase
      .from('contact_tags')
      .select('contact_id')
      .in('tag_id', tagIds)
    const grouped: Record<string, Set<string>> = {}
    ;(tagRows ?? []).forEach((r: { contact_id: string }) => {
      if (!grouped[r.contact_id]) grouped[r.contact_id] = new Set()
      grouped[r.contact_id].add(r.contact_id)
    })
    // Keep contacts that have ALL tags (count-based — each row is one tag match)
    // For simplicity: count per contact
    const countMap: Record<string, number> = {}
    ;(tagRows ?? []).forEach((r: { contact_id: string }) => {
      countMap[r.contact_id] = (countMap[r.contact_id] ?? 0) + 1
    })
    tagContactIds = Object.entries(countMap)
      .filter(([, c]) => c >= tagIds.length)
      .map(([id]) => id)
    if (tagContactIds.length === 0) return null
  }

  // Build base query (no pagination).
  let query = supabase
    .from('contacts')
    .select('*, contact_tags(tag:tags(name, color)), assignee:profiles!contacts_assigned_to_fkey(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply reminder contact-id filter
  if (reminderContactIds !== null) {
    query = query.in('id', reminderContactIds)
  }

  // Apply tag filter
  if (tagContactIds !== null) {
    query = query.in('id', tagContactIds)
  }

  // Full-text search across name/phone/email + text custom fields
  if (search.trim()) {
    const term = `%${search.trim()}%`
    const parts = [
      `name.ilike.${term}`,
      `phone.ilike.${term}`,
      `email.ilike.${term}`,
      ...customTextFields.map((f) => `custom_data->>${f.id}.ilike.${term}`),
    ]
    query = query.or(parts.join(','))
  }

  // Assignee filter
  if (assigneeFilter.length > 0) {
    query = query.in('assigned_to', assigneeFilter)
  }

  // Custom field filters
  for (const f of filterFields) {
    const selected = activeFilters[f.id]
    if (!selected || selected.length === 0) continue
    if (f.field_type === 'file') {
      if (selected[0] === 'available') {
        query = query.not(`custom_data->>${f.id}`, 'is', null)
      } else if (selected[0] === 'unavailable') {
        query = query.is(`custom_data->>${f.id}`, null)
      }
    } else if (f.field_type === 'select') {
      const orParts = selected.map((v) => `custom_data->>${f.id}.eq.${v}`)
      query = query.or(orParts.join(','))
    } else if (f.field_type === 'multi_select') {
      for (const v of selected) {
        query = query.filter(`custom_data->${f.id}`, 'cs', `["${v}"]`)
      }
    }
  }

  return query
}
