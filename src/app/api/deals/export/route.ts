import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildDealsQuery, type DealFilters } from '@/lib/export/deals-query'
import { rowsToCSV } from '@/lib/export/csv'

const EXPORT_LIMIT = 50_000

/**
 * GET /api/deals/export
 *
 * Streams a filter-aware CSV of deals. Accepts the same filter params used
 * by the pipelines and closed-deals list pages so exported rows always match
 * what the user sees on screen.
 *
 * Query params:
 *   status_tab      - all | open | won | lost
 *   search          - full-text search
 *   assignee        - repeatable; profile IDs
 *   lost_reason     - repeatable; lost reason IDs
 *   reminder_tab    - all | today | missed | upcoming | today_missed (open deals)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const p = request.nextUrl.searchParams
    const statusTab = (p.get('status_tab') ?? 'all') as DealFilters['statusTab']
    const search = p.get('search') ?? ''
    const assigneeFilter = p.getAll('assignee')
    const lostReasonFilter = p.getAll('lost_reason')
    const reminderTab = p.get('reminder_tab') ?? 'all'

    const baseQuery = await buildDealsQuery(supabase, {
      statusTab,
      search,
      assigneeFilter,
      lostReasonFilter,
      reminderTab,
    })

    if (baseQuery === null) {
      const date = new Date().toISOString().slice(0, 10)
      const headers = new Headers({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="deals-${date}.csv"`,
      })
      return new NextResponse(
        'Deal Title,Contact Name,Contact Phone,Value,Currency,Stage,Status,Lost Reason,Assignee,Expected Close Date,Closed Date,Created At,Notes',
        { headers },
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: deals, error } = await (baseQuery as any).limit(EXPORT_LIMIT)

    if (error) {
      console.error('[deals/export] query error:', error)
      return NextResponse.json({ error: 'Failed to export deals' }, { status: 500 })
    }

    // Fetch custom deal fields for additional columns
    const { data: customFields } = await supabase
      .from('custom_fields')
      .select('id, field_name, field_type')
      .eq('applies_to', 'deal')
      .order('sort_order')

    const standardColumns = [
      'Deal Title', 'Contact Name', 'Contact Phone', 'Value', 'Currency',
      'Stage', 'Status', 'Lost Reason', 'Assignee',
      'Expected Close Date', 'Closed Date', 'Created At', 'Notes',
    ]
    const customColumns = (customFields ?? []).map((f) => f.field_name)
    const allColumns = [...standardColumns, ...customColumns]

    const rows = (deals ?? []).map((d: Record<string, unknown>) => {
      const contact = d.contact as Record<string, unknown> | null
      const assignee = d.assignee as { full_name?: string } | null
      const stage = d.stage as { name?: string } | null
      const lostReason = d.lost_reason as { reason?: string } | null
      const customData = (d.custom_data ?? {}) as Record<string, unknown>

      const row: Record<string, unknown> = {
        'Deal Title': d.title ?? '',
        'Contact Name': contact?.name ?? '',
        'Contact Phone': contact?.phone ?? '',
        Value: d.value ?? '',
        Currency: d.currency ?? 'USD',
        Stage: stage?.name ?? '',
        Status: d.status ?? '',
        'Lost Reason': lostReason?.reason ?? '',
        Assignee: assignee?.full_name ?? '',
        'Expected Close Date': d.expected_close_date
          ? new Date(d.expected_close_date as string).toISOString().slice(0, 10)
          : '',
        'Closed Date': d.closed_at
          ? new Date(d.closed_at as string).toISOString().slice(0, 10)
          : '',
        'Created At': d.created_at
          ? new Date(d.created_at as string).toISOString().slice(0, 10)
          : '',
        Notes: d.notes ?? '',
      }

      for (const f of customFields ?? []) {
        const val = customData[f.id]
        row[f.field_name] = Array.isArray(val) ? val.join('; ') : (val ?? '')
      }

      return row
    })

    const csv = rowsToCSV(rows, allColumns)
    const date = new Date().toISOString().slice(0, 10)
    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="deals-${date}.csv"`,
    })
    return new NextResponse(csv, { headers })
  } catch (err) {
    console.error('[deals/export] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
