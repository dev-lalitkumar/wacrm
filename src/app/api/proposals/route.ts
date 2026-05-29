import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { generateProposalNumber } from '@/lib/proposals/number-generator'

export async function GET(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const dealId = searchParams.get('deal_id')

  const supabase = await createClient()
  let query = supabase
    .from('proposals')
    .select(`
      *,
      contact:contacts(id, name, email, phone, company),
      deal:deals(id, title, value, currency)
    `)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (dealId) query = query.eq('deal_id', dealId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = await createClient()
  const proposalNumber = await generateProposalNumber(supabase)

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      user_id: caller.userId,
      created_by: caller.profileId,
      proposal_number: proposalNumber,
      title: body.title ?? 'New Proposal',
      deal_id: body.deal_id ?? null,
      contact_id: body.contact_id ?? null,
      currency: body.currency ?? 'USD',
      valid_until: body.valid_until ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If seeding from deal's catalog items, create proposal items
  if (body.deal_id && body.seed_from_deal) {
    const { data: dealItems } = await supabase
      .from('deal_catalog_items')
      .select('*')
      .eq('deal_id', body.deal_id)

    if (dealItems && dealItems.length > 0) {
      const itemIds = dealItems.map(di => di.catalog_item_id).filter(Boolean)
      let priceMap: Record<string, number> = {}
      if (itemIds.length > 0) {
        const { data: catalogItems } = await supabase
          .from('catalog_items')
          .select('id, price, currency')
          .in('id', itemIds)
        if (catalogItems) {
          for (const ci of catalogItems) priceMap[ci.id] = ci.price
        }
      }

      await supabase.from('proposal_items').insert(
        dealItems.map((di, idx) => ({
          proposal_id: data.id,
          catalog_item_id: di.catalog_item_id ?? null,
          name: di.name,
          quantity: di.quantity,
          unit_price: di.catalog_item_id ? (priceMap[di.catalog_item_id] ?? 0) : 0,
          discount_pct: 0,
          total: di.quantity * (di.catalog_item_id ? (priceMap[di.catalog_item_id] ?? 0) : 0),
          sort_order: idx,
        }))
      )
    }
  }

  // Log creation in history
  await supabase.from('proposal_history').insert({
    proposal_id: data.id,
    action: 'created',
    actor_id: caller.profileId,
  })

  return NextResponse.json(data, { status: 201 })
}
