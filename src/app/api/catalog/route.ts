import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'

export async function GET(): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      user_id: caller.userId,
      name: body.name,
      description: body.description ?? null,
      price: body.price ?? 0,
      currency: body.currency ?? 'USD',
      unit: body.unit ?? 'unit',
      category: body.category ?? null,
      image_url: body.image_url ?? null,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
