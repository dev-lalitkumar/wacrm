import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthedCaller } from '@/lib/auth/require-role'
import { decrypt } from '@/lib/encryption'
import { PROVIDER_TEMPLATES } from '@/lib/telephony/providers'

/**
 * POST /api/telephony/call
 *
 * Initiates a click-to-call via the active telephony provider.
 * Any authenticated user can trigger this.
 *
 * Body: { contact_id: string, deal_id?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthedCaller()
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as {
      contact_id: string
      deal_id?: string | null
    }

    if (!body.contact_id) {
      return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Load active provider
    const { data: providerRow } = await supabase
      .from('telephony_providers')
      .select('id, provider_key, config, webhook_identifier')
      .eq('is_active', true)
      .maybeSingle()

    if (!providerRow?.config) {
      return NextResponse.json(
        { error: 'No telephony provider configured. Set up in Settings → Call Center.' },
        { status: 400 },
      )
    }

    const tpl = PROVIDER_TEMPLATES[providerRow.provider_key]
    if (!tpl) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    // Decrypt provider config
    let config: Record<string, string> = {}
    try {
      config = JSON.parse(decrypt(providerRow.config)) as Record<string, string>
    } catch {
      return NextResponse.json({ error: 'Failed to decrypt provider config' }, { status: 500 })
    }

    // Load agent phone from profiles
    const { data: agentProfile } = await supabase
      .from('profiles')
      .select('phone, full_name, email')
      .eq('id', caller.profileId)
      .maybeSingle()

    const agentPhone = agentProfile?.phone?.trim()
    if (!agentPhone) {
      return NextResponse.json(
        { error: 'Your phone number is not set. Go to Settings → Profile to add it.' },
        { status: 400 },
      )
    }

    // Load contact phone
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .eq('id', body.contact_id)
      .maybeSingle()

    if (!contact?.phone) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 },
      )
    }

    const contactPhone = contact.phone.trim()
    const agentEmail = agentProfile?.email ?? caller.email

    // Build API request
    const url = tpl.buildUrl(config, agentPhone, contactPhone, agentEmail)
    const headers = tpl.buildHeaders(config)
    const bodyPayload = tpl.buildBody(config, agentPhone, contactPhone)

    // Send to provider
    let responseStatus = 0
    let responseBody: unknown = null

    try {
      const res = await fetch(url, {
        method: tpl.requestMethod,
        headers,
        body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
      })
      responseStatus = res.status
      responseBody = await res.json().catch(() => null)
    } catch (err) {
      console.error('[telephony/call] provider request failed:', err)
      responseStatus = 500
      responseBody = { error: String(err) }
    }

    // Parse provider call ID from response
    const { providerCallId } = tpl.parseCallResponse(responseBody)

    // Insert call log
    const { data: logRow, error: logErr } = await supabase
      .from('telephony_call_logs')
      .insert({
        provider_call_id: providerCallId,
        provider_id: providerRow.id,
        contact_id: body.contact_id,
        deal_id: body.deal_id ?? null,
        initiated_by: caller.profileId,
        from_number: agentPhone,
        to_number: contactPhone,
        status: responseStatus >= 200 && responseStatus < 300 ? 'initiated' : 'failed',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (logErr) {
      console.error('[telephony/call] log insert error:', logErr)
    }

    const success = responseStatus >= 200 && responseStatus < 300
    return NextResponse.json({
      success,
      call_log_id: logRow?.id ?? null,
      provider_call_id: providerCallId,
      message: success
        ? 'Your phone will ring shortly. Answer it to be connected to the contact.'
        : 'Provider returned an error. Check your Call Center configuration.',
    })
  } catch (err) {
    console.error('[telephony/call] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
