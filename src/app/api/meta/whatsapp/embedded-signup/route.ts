import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { upsertCredentials } from '@/lib/whatsapp/onboarding/repository'
import { scheduleOnboardingPipeline } from '@/lib/whatsapp/onboarding/schedule'

/**
 * POST /api/meta/whatsapp/embedded-signup
 *
 * Stores embedded signup credentials and starts the verification pipeline.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await requireRole(['admin', 'owner'])
    if (isErrorResponse(caller)) return caller

    const body = (await req.json()) as {
      phone_number_id?: string
      waba_id?: string
      access_token?: string
      onboarding_test_phone?: string
    }

    if (!body.phone_number_id || !body.waba_id || !body.access_token) {
      return NextResponse.json(
        { error: 'phone_number_id, waba_id, and access_token are required' },
        { status: 400 },
      )
    }

    if (!body.onboarding_test_phone?.trim()) {
      return NextResponse.json(
        { error: 'onboarding_test_phone is required' },
        { status: 400 },
      )
    }

    const saved = await upsertCredentials({
      phone_number_id: body.phone_number_id,
      waba_id: body.waba_id,
      access_token: body.access_token,
      onboarding_test_phone: body.onboarding_test_phone.trim(),
      connection_type: 'embedded_signup',
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
    })
  } catch (err) {
    console.error('[meta/whatsapp/embedded-signup] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
