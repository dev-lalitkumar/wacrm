import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { FIXED_PIPELINE_ID } from '@/lib/pipeline/constants'

const CHUNK_SIZE = 50

interface ImportRow {
  title?: string
  contact_phone?: string
  value?: string | number
  currency?: string
  stage_name?: string
  expected_close_date?: string
  notes?: string
  assigned_to_email?: string
  [key: string]: unknown // custom field columns
}

/**
 * POST /api/deals/import
 *
 * Bulk-import deals from a parsed CSV. Each row must reference an existing
 * contact by phone number — no new contacts are created on import.
 *
 * Body: { rows: ImportRow[], source_id: string }
 *
 * Returns: { imported: number, failed: number, errors: { row: number; reason: string }[] }
 */
export async function POST(request: NextRequest) {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: { rows: ImportRow[]; source_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rows = body.rows ?? []
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: 'Maximum 5 000 rows per import' }, { status: 400 })
  }

  const supabase = await createClient()

  // Pre-load pipeline stages for name matching
  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('id, name, position')
    .eq('pipeline_id', FIXED_PIPELINE_ID)
    .order('position')

  if (!stages || stages.length === 0) {
    return NextResponse.json({ error: 'Pipeline has no stages' }, { status: 400 })
  }

  const defaultStageId = stages[0].id
  const stageByName: Record<string, string> = {}
  stages.forEach((s: { id: string; name: string }) => {
    stageByName[s.name.toLowerCase().trim()] = s.id
  })

  // Resolve a default source_id (the "import" source or any first available)
  let sourceId = body.source_id ?? null
  if (!sourceId) {
    const { data: sources } = await supabase
      .from('sources')
      .select('id, name')
      .order('created_at')
    const importSource = (sources ?? []).find((s: { name: string }) =>
      s.name.toLowerCase().includes('import'),
    )
    sourceId = importSource?.id ?? sources?.[0]?.id ?? null
  }
  if (!sourceId) {
    return NextResponse.json(
      { error: 'No source found. Create a source named "Import" in Settings → Sources first.' },
      { status: 400 },
    )
  }

  // Fetch all assignable profiles for email lookup
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
  const profileByEmail: Record<string, string> = {}
  ;(profiles ?? []).forEach((p: { id: string; email: string }) => {
    if (p.email) profileByEmail[p.email.toLowerCase()] = p.id
  })

  // Custom field definitions
  const { data: customFields } = await supabase
    .from('custom_fields')
    .select('id, field_name, field_type')
    .eq('applies_to', 'deal')

  // Collect all unique phone numbers for batch contact lookup
  const phones = [...new Set(
    rows.map((r) => (r.contact_phone ?? '').toString().trim()).filter(Boolean),
  )]

  let contactByPhone: Record<string, string> = {}
  if (phones.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone')
      .in('phone', phones)
    ;(contacts ?? []).forEach((c: { id: string; phone: string }) => {
      contactByPhone[c.phone] = c.id
    })
  }

  const errors: { row: number; reason: string }[] = []
  const dealsToInsert: Record<string, unknown>[] = []
  const rowIndexMap: number[] = [] // maps dealsToInsert index → original row index

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const rowNum = i + 2 // 1-indexed + header row

    const title = (r.title ?? '').toString().trim()
    if (!title) {
      errors.push({ row: rowNum, reason: 'title is required' })
      continue
    }

    const phone = (r.contact_phone ?? '').toString().trim()
    if (!phone) {
      errors.push({ row: rowNum, reason: 'contact_phone is required' })
      continue
    }

    const contactId = contactByPhone[phone]
    if (!contactId) {
      errors.push({ row: rowNum, reason: `No contact found with phone "${phone}"` })
      continue
    }

    const stageName = (r.stage_name ?? '').toString().trim().toLowerCase()
    const stageId = stageByName[stageName] ?? defaultStageId

    const assignedToEmail = (r.assigned_to_email ?? '').toString().trim().toLowerCase()
    const assignedTo = assignedToEmail
      ? (profileByEmail[assignedToEmail] ?? caller.profileId)
      : caller.profileId

    const value = r.value !== undefined && r.value !== '' ? Number(r.value) : null

    // Build custom_data from custom field columns
    const customData: Record<string, unknown> = {}
    for (const f of customFields ?? []) {
      const val = r[f.field_name]
      if (val !== undefined && val !== '') {
        if (f.field_type === 'number') {
          customData[f.id] = Number(val)
        } else if (f.field_type === 'multi_select') {
          customData[f.id] = String(val).split(';').map((v) => v.trim()).filter(Boolean)
        } else {
          customData[f.id] = String(val)
        }
      }
    }

    dealsToInsert.push({
      title,
      contact_id: contactId,
      pipeline_id: FIXED_PIPELINE_ID,
      stage_id: stageId,
      source_id: sourceId,
      assigned_to: assignedTo,
      user_id: caller.userId,
      value: isNaN(value as number) || value === null ? null : value,
      currency: (r.currency ?? '').toString().trim() || 'USD',
      notes: (r.notes ?? '').toString().trim() || null,
      expected_close_date: r.expected_close_date
        ? new Date(String(r.expected_close_date)).toISOString().slice(0, 10)
        : null,
      custom_data: Object.keys(customData).length > 0 ? customData : null,
      status: 'open',
    })
    rowIndexMap.push(rowNum)
  }

  // Batch insert in chunks
  let imported = 0
  for (let i = 0; i < dealsToInsert.length; i += CHUNK_SIZE) {
    const chunk = dealsToInsert.slice(i, i + CHUNK_SIZE)
    const { data: inserted, error } = await supabase
      .from('deals')
      .insert(chunk)
      .select('id')

    if (error) {
      // Mark all rows in this chunk as failed
      for (let j = i; j < Math.min(i + CHUNK_SIZE, dealsToInsert.length); j++) {
        errors.push({ row: rowIndexMap[j], reason: error.message })
      }
    } else {
      imported += inserted?.length ?? chunk.length
    }
  }

  return NextResponse.json({
    imported,
    failed: errors.length,
    errors,
  })
}
