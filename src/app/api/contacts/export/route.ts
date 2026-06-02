import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildContactsQuery } from '@/lib/export/contacts-query'
import { rowsToCSV } from '@/lib/export/csv'

const EXPORT_LIMIT = 50_000

/**
 * GET /api/contacts/export
 *
 * Streams a filter-aware CSV of contacts. Accepts the same filter params
 * that the contacts list page sends so the exported rows always match what
 * the user sees on screen.
 *
 * Query params:
 *   search          - full-text search string
 *   assignee        - repeatable; profile IDs  e.g. ?assignee=id1&assignee=id2
 *   tags            - repeatable; tag IDs
 *   reminder_tab    - all | today | missed | upcoming | today_missed
 *   cf_{fieldId}    - repeatable; custom field filter values
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = request.nextUrl.searchParams
    const search = p.get('search') ?? ''
    const assigneeFilter = p.getAll('assignee')
    const tagIds = p.getAll('tags')
    const reminderTab = p.get('reminder_tab') ?? 'all'

    // Parse custom field filters: keys matching cf_{fieldId}
    const activeFilters: Record<string, string[]> = {}
    for (const [key, value] of p.entries()) {
      if (key.startsWith('cf_')) {
        const fieldId = key.slice(3)
        if (!activeFilters[fieldId]) activeFilters[fieldId] = []
        activeFilters[fieldId].push(value)
      }
    }

    // Fetch custom field definitions (needed for filter + column generation)
    const { data: allFields } = await supabase
      .from('custom_fields')
      .select('id, field_name, field_type')
      .eq('applies_to', 'contact')
      .order('sort_order')

    const customTextFields = (allFields ?? []).filter((f) =>
      f.field_type === 'text' || f.field_type === 'number',
    )
    const filterFields = (allFields ?? []).filter((f) =>
      ['select', 'multi_select', 'file'].includes(f.field_type),
    )

    const baseQuery = await buildContactsQuery(supabase, {
      search,
      assigneeFilter,
      reminderTab,
      tagIds,
      activeFilters,
      filterFields,
      customTextFields,
    })

    if (baseQuery === null) {
      // Empty result due to sub-query — return CSV with headers only
      const date = new Date().toISOString().slice(0, 10)
      const headers = new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contacts-${date}.csv"`,
      })
      return new NextResponse('Name,Phone,Email,Company,Tags,Assigned To,Created At', { headers })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error } = await (baseQuery as any).limit(EXPORT_LIMIT)

    if (error) {
      console.error('[contacts/export] query error:', error)
      return NextResponse.json({ error: 'Failed to export contacts' }, { status: 500 })
    }

    // Fetch tag names for all returned contacts
    const contactIds = (contacts ?? []).map((c: { id: string }) => c.id)
    const { data: tagRows } = await supabase
      .from('contact_tags')
      .select('contact_id, tag:tags(name)')
      .in('contact_id', contactIds.length > 0 ? contactIds : ['00000000-0000-0000-0000-000000000000'])

    const tagsByContact: Record<string, string[]> = {}
    ;(tagRows ?? []).forEach((r: { contact_id: string; tag: { name: string }[] | { name: string } | null }) => {
      const tags = Array.isArray(r.tag) ? r.tag : r.tag ? [r.tag] : []
      tags.forEach((t) => {
        if (!tagsByContact[r.contact_id]) tagsByContact[r.contact_id] = []
        tagsByContact[r.contact_id].push(t.name)
      })
    })

    // Build column list
    const customColumns = (allFields ?? []).map((f) => f.field_name)
    const standardColumns = ['Name', 'Phone', 'Email', 'Company', 'Tags', 'Assigned To', 'Created At']
    const allColumns = [...standardColumns, ...customColumns]

    // Map to flat rows
    const rows = (contacts ?? []).map((c: Record<string, unknown>) => {
      const assignee = c.assignee as { full_name?: string } | null
      const tags = (tagsByContact[c.id as string] ?? []).join('; ')
      const row: Record<string, unknown> = {
        Name: c.name ?? '',
        Phone: c.phone ?? '',
        Email: c.email ?? '',
        Company: c.company ?? '',
        Tags: tags,
        'Assigned To': assignee?.full_name ?? '',
        'Created At': c.created_at ? new Date(c.created_at as string).toISOString().slice(0, 10) : '',
      }
      // Flatten custom fields
      const customData = (c.custom_data ?? {}) as Record<string, unknown>
      for (const f of allFields ?? []) {
        const val = customData[f.id]
        row[f.field_name] = Array.isArray(val) ? val.join('; ') : (val ?? '')
      }
      return row
    })

    const csv = rowsToCSV(rows, allColumns)
    const date = new Date().toISOString().slice(0, 10)
    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contacts-${date}.csv"`,
    })
    return new NextResponse(csv, { headers })
  } catch (err) {
    console.error('[contacts/export] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
