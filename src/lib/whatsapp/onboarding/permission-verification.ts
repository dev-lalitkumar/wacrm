import { debugAccessToken } from '@/lib/whatsapp/meta-api'
import { updateWhatsAppConfig } from './repository'

const REQUIRED_SCOPES = [
  'business_management',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

export async function verifyPermissions(
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const debug = await debugAccessToken(accessToken)
    const scopes = debug.scopes ?? debug.data?.scopes ?? []
    const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s))

    const payload = {
      scopes,
      type: debug.type,
      expires_at: debug.expires_at,
      missing,
    }

    if (missing.length > 0) {
      await updateWhatsAppConfig({
        permissions_verified: false,
        permissions_payload: payload,
        status: 'FAILED',
        onboarding_step: 'FAILED',
        failure_reason: `Missing required permissions: ${missing.join(', ')}`,
      })
      return { ok: false, error: 'Missing Required Permissions' }
    }

    await updateWhatsAppConfig({
      permissions_verified: true,
      permissions_payload: payload,
      token_type: debug.type ?? null,
      status: 'PERMISSIONS_VERIFIED',
      onboarding_step: 'PERMISSIONS_VERIFIED',
      failure_reason: null,
    })

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Permission verification failed'
    return { ok: false, error: msg }
  }
}
