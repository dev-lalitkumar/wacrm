import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'

/**
 * GET /api/meta/field-mappings?form_id=X
 *
 * Returns all field mappings for a lead form.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const formId = req.nextUrl.searchParams.get('form_id')
    if (!formId) {
      return NextResponse.json({ error: 'form_id is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('facebook_field_mappings')
      .select('*')
      .eq('form_id', formId)
      .order('fb_field_key')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ mappings: data ?? [] })
  } catch (err) {
    console.error('[meta/field-mappings] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

interface MappingInput {
  fb_field_key: string
  crm_object: 'contact' | 'deal'
  crm_field: string
}

/**
 * POST /api/meta/field-mappings
 *
 * Replace all mappings for a form atomically (delete + insert).
 * Body: { form_id: string, mappings: MappingInput[] }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const body = (await req.json()) as {
      form_id: string
      mappings: MappingInput[]
    }

    if (!body.form_id) {
      return NextResponse.json({ error: 'form_id is required' }, { status: 400 })
    }

    const validMappings = (body.mappings ?? []).filter(
      (m) => m.fb_field_key && m.crm_object && m.crm_field,
    )

    const supabase = await createClient()

    // Delete all existing mappings for the form
    const { error: delErr } = await supabase
      .from('facebook_field_mappings')
      .delete()
      .eq('form_id', body.form_id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    if (validMappings.length > 0) {
      const rows = validMappings.map((m) => ({
        form_id: body.form_id,
        fb_field_key: m.fb_field_key,
        crm_object: m.crm_object,
        crm_field: m.crm_field,
      }))

      const { error: insErr } = await supabase
        .from('facebook_field_mappings')
        .insert(rows)

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, count: validMappings.length })
  } catch (err) {
    console.error('[meta/field-mappings] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
