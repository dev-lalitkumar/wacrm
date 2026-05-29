import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { encrypt, decrypt } from '@/lib/encryption'
import { PROVIDER_TEMPLATES } from '@/lib/telephony/providers'
import type { TelephonyProviderKey } from '@/lib/telephony/types'

const getSiteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

/**
 * GET /api/telephony/config
 * Returns active provider info (never exposes secrets).
 * Any authenticated user may call this — UI uses it to decide
 * whether to show the click-to-call button.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: provider } = await supabase
      .from('telephony_providers')
      .select('id, name, provider_key, is_active, webhook_identifier')
      .eq('is_active', true)
      .maybeSingle()

    if (!provider) {
      return NextResponse.json({
        configured: false,
        provider_key: null,
        name: null,
        webhook_identifier: null,
        webhook_url: null,
        configFields: [],
      })
    }

    const tpl = PROVIDER_TEMPLATES[provider.provider_key]
    const webhookUrl = provider.webhook_identifier
      ? `${getSiteUrl()}/api/telephony/webhook/${provider.webhook_identifier}`
      : null

    return NextResponse.json({
      configured: true,
      provider_key: provider.provider_key,
      name: provider.name,
      webhook_identifier: provider.webhook_identifier,
      webhook_url: webhookUrl,
      configFields: tpl?.configFields ?? [],
    })
  } catch (err) {
    console.error('[telephony/config] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/telephony/config
 * Save / update the active telephony provider.
 * Admin/Owner only.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const body = (await req.json()) as {
      provider_key: TelephonyProviderKey
      config: Record<string, string>
    }

    if (!body.provider_key || !PROVIDER_TEMPLATES[body.provider_key]) {
      return NextResponse.json({ error: 'Invalid provider_key' }, { status: 400 })
    }

    const tpl = PROVIDER_TEMPLATES[body.provider_key]

    // Validate required config fields
    const missing = tpl.configFields
      .filter((f) => f.required && !body.config?.[f.key]?.trim())
      .map((f) => f.label)
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      )
    }

    const encryptedConfig = encrypt(JSON.stringify(body.config))

    const supabase = await createClient()

    // Deactivate any existing providers
    await supabase
      .from('telephony_providers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true)
      .neq('provider_key', body.provider_key)

    // Upsert the chosen provider
    const { error } = await supabase
      .from('telephony_providers')
      .upsert(
        {
          name: tpl.name,
          provider_key: body.provider_key,
          is_active: true,
          config: encryptedConfig,
          webhook_identifier: tpl.webhookIdentifier,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider_key' },
      )

    if (error) {
      console.error('[telephony/config] POST upsert error:', error)
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[telephony/config] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/telephony/config
 * Deactivate the current provider.
 * Admin/Owner only.
 */
export async function DELETE() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const supabase = await createClient()
    await supabase
      .from('telephony_providers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[telephony/config] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Export for use in call route
export { decrypt }
