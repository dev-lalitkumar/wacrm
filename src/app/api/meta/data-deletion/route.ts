import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin-client'

/**
 * POST /api/meta/data-deletion
 *
 * Meta's Data Deletion Callback URL.
 *
 * When a Facebook user removes your app or requests their data be
 * deleted, Meta sends a POST with a `signed_request` form parameter.
 *
 * We:
 *   1. Verify the HMAC-SHA256 signature using META_APP_SECRET.
 *   2. Generate a unique confirmation_code.
 *   3. Log the request to meta_data_deletion_requests (admin reviews manually).
 *   4. Return JSON with `url` (status page) and `confirmation_code`.
 *
 * Ref: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
export async function POST(req: NextRequest) {
  try {
    // Meta sends as application/x-www-form-urlencoded
    const formData = await req.formData()
    const signedRequest = formData.get('signed_request') as string | null

    if (!signedRequest) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
    }

    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      console.error('[data-deletion] META_APP_SECRET not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Parse: encodedSig.payload
    const parts = signedRequest.split('.')
    if (parts.length !== 2) {
      return NextResponse.json({ error: 'Invalid signed_request format' }, { status: 400 })
    }

    const [encodedSig, encodedPayload] = parts

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as {
      algorithm?: string
      issued_at?: number
      user_id?: string
    }

    if (payload.algorithm?.toUpperCase() !== 'HMAC-SHA256') {
      return NextResponse.json({ error: 'Unsupported algorithm' }, { status: 400 })
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const provided = Buffer.from(encodedSig)
    const expected = Buffer.from(expectedSig)
    const sigValid =
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected)

    if (!sigValid) {
      console.warn('[data-deletion] invalid signature on signed_request')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const fbUserId = payload.user_id
    if (!fbUserId) {
      return NextResponse.json({ error: 'Missing user_id in payload' }, { status: 400 })
    }

    // Generate unique confirmation code
    const confirmationCode = crypto.randomBytes(16).toString('hex')

    // Log the deletion request (admin reviews manually)
    const admin = supabaseAdmin()
    await admin.from('meta_data_deletion_requests').insert({
      confirmation_code: confirmationCode,
      fb_user_id: fbUserId,
      status: 'pending',
      raw_payload: payload,
    })

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')

    // Meta requires this exact response shape
    return NextResponse.json({
      url: `${siteUrl}/data-deletion/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error('[data-deletion] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/meta/data-deletion
 *
 * Returns status of a deletion request by confirmation_code.
 * Used by the public status page.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data } = await admin
    .from('meta_data_deletion_requests')
    .select('confirmation_code, status, created_at, processed_at')
    .eq('confirmation_code', code)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  return NextResponse.json({
    confirmation_code: data.confirmation_code,
    status: data.status,
    submitted_at: data.created_at,
    processed_at: data.processed_at ?? null,
  })
}
