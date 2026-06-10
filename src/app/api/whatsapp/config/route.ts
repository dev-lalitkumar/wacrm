import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'
import { getDecryptedWhatsAppCredentials } from '@/lib/whatsapp/credentials'
import { upsertCredentials } from '@/lib/whatsapp/onboarding/repository'
import { scheduleOnboardingPipeline } from '@/lib/whatsapp/onboarding/schedule'
import { disconnectWhatsApp } from '@/lib/whatsapp/onboarding/repository'

/**
 * GET /api/whatsapp/config
 *
 * Verifies stored credentials against Meta. Any signed-in member can call.
 */
export async function GET() {
  try {
    const creds = await getDecryptedWhatsAppCredentials()

    if (!creds) {
      return NextResponse.json({
        connected: false,
        reason: 'no_config',
        message: 'No WhatsApp configuration saved yet.',
        is_ready: false,
        onboarding_status: 'NOT_CONNECTED',
      })
    }

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
      })
      return NextResponse.json({
        connected: true,
        is_ready: creds.isReady,
        onboarding_status: creds.config.status,
        phone_info: phoneInfo,
        setup_warning: !creds.isReady
          ? 'WhatsApp credentials work but onboarding is not complete. Check Settings → WhatsApp Setup.'
          : null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({
        connected: false,
        reason: 'meta_api_error',
        message: `Meta API rejected the credentials: ${message}`,
        is_ready: false,
        onboarding_status: creds.config.status,
      })
    }
  } catch (error) {
    console.error('Error in WhatsApp config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/whatsapp/config — manual credential entry, starts verification pipeline.
 */
export async function POST(request: Request) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const body = await request.json()
    const {
      phone_number_id,
      waba_id,
      access_token,
      verify_token,
      onboarding_test_phone,
    } = body

    if (!access_token || !phone_number_id || !onboarding_test_phone?.trim()) {
      return NextResponse.json(
        { error: 'access_token, phone_number_id, and onboarding_test_phone are required' },
        { status: 400 },
      )
    }

    try {
      await verifyPhoneNumber({ phoneNumberId: phone_number_id, accessToken: access_token })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
    }

    const saved = await upsertCredentials({
      phone_number_id,
      waba_id: waba_id || '',
      access_token,
      verify_token: verify_token || null,
      onboarding_test_phone: onboarding_test_phone.trim(),
      connection_type: 'manual',
      created_by: caller.profileId,
    })

    if (!saved) {
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
    }

    scheduleOnboardingPipeline()

    return NextResponse.json({
      success: true,
      status: saved.status,
      onboarding_step: saved.onboarding_step,
      message: 'Credentials saved. Verification pipeline started.',
    })
  } catch (error) {
    console.error('Error in WhatsApp config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/whatsapp/config — disconnect (soft).
 */
export async function DELETE() {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    await disconnectWhatsApp()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in WhatsApp config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
