import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { encrypt } from '@/lib/encryption'

/**
 * POST /api/meta/whatsapp/embedded-signup
 *
 * Stores the WABA and phone number IDs obtained from the WhatsApp
 * Embedded Signup flow. Updates the existing whatsapp_config row.
 *
 * Body: { phone_number_id: string, waba_id: string, access_token: string }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const body = (await req.json()) as {
      phone_number_id?: string
      waba_id?: string
      access_token?: string
    }

    if (!body.phone_number_id || !body.waba_id || !body.access_token) {
      return NextResponse.json(
        { error: 'phone_number_id, waba_id, and access_token are required' },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Check if a whatsapp_config row exists for this user
    const { data: existing } = await supabase
      .from('whatsapp_config')
      .select('id')
      .eq('user_id', caller.userId)
      .maybeSingle()

    const encryptedToken = encrypt(body.access_token)

    if (existing) {
      const { error } = await supabase
        .from('whatsapp_config')
        .update({
          phone_number_id: body.phone_number_id,
          waba_id: body.waba_id,
          access_token: encryptedToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', caller.userId)

      if (error) {
        console.error('[meta/whatsapp/embedded-signup] update error:', error)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    } else {
      const { error } = await supabase.from('whatsapp_config').insert({
        user_id: caller.userId,
        phone_number_id: body.phone_number_id,
        waba_id: body.waba_id,
        access_token: encryptedToken,
        status: 'connected',
        connected_at: new Date().toISOString(),
      })

      if (error) {
        console.error('[meta/whatsapp/embedded-signup] insert error:', error)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[meta/whatsapp/embedded-signup] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
