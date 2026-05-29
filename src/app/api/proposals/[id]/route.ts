import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(id, name, email, phone, company),
      deal:deals(id, title, value, currency),
      items:proposal_items(* )
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })

  const { data: history } = await supabase
    .from('proposal_history')
    .select('*, actor:profiles(id, full_name, email)')
    .eq('proposal_id', id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ ...data, history: history ?? [] })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createClient()

  // Handle proposal_items separately
  const items = body.items as Array<Record<string, unknown>> | undefined
  delete body.items
  delete body.contact
  delete body.deal
  delete body.history

  const { data, error } = await supabase
    .from('proposals')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync items if provided
  if (items !== undefined) {
    await supabase.from('proposal_items').delete().eq('proposal_id', id)
    if (items.length > 0) {
      await supabase.from('proposal_items').insert(
        items.map((item, idx) => ({
          proposal_id: id,
          catalog_item_id: item.catalog_item_id ?? null,
          name: item.name,
          description: item.description ?? null,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          discount_pct: item.discount_pct ?? 0,
          total: item.total ?? 0,
          sort_order: item.sort_order ?? idx,
        }))
      )
    }

    // Recalculate totals
    const subtotal = items.reduce((s, i) => s + Number(i.total ?? 0), 0)
    const taxRate = Number(body.tax_rate ?? data.tax_rate ?? 0)
    const discountAmount = Number(body.discount_amount ?? data.discount_amount ?? 0)
    const totalAmount = subtotal - discountAmount + subtotal * (taxRate / 100)

    await supabase.from('proposals').update({
      subtotal,
      total_amount: Math.max(0, totalAmount),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  // Log edit in history
  await supabase.from('proposal_history').insert({
    proposal_id: id,
    action: 'edited',
    actor_id: caller.profileId,
  })

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('proposals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
