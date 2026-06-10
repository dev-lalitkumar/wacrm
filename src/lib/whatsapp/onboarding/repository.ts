import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { encrypt } from '@/lib/encryption'
import type {
  OnboardingStatus,
  SaveCredentialsInput,
  WhatsAppConfig,
} from './types'

const TABLE = 'whatsapp_config'
const SINGLETON_ID = 1

export async function getWhatsAppConfig(
  admin: SupabaseClient = supabaseAdmin(),
): Promise<WhatsAppConfig | null> {
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', SINGLETON_ID)
    .maybeSingle()

  if (error || !data) return null
  return data as WhatsAppConfig
}

export async function upsertCredentials(
  input: SaveCredentialsInput,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<WhatsAppConfig | null> {
  const encryptedToken = encrypt(input.access_token)
  const encryptedVerify = input.verify_token ? encrypt(input.verify_token) : null

  const row = {
    id: SINGLETON_ID,
    phone_number_id: input.phone_number_id,
      waba_id: input.waba_id || null,
    access_token: encryptedToken,
    verify_token: encryptedVerify,
    connection_type: input.connection_type,
    onboarding_test_phone: input.onboarding_test_phone,
    status: 'EMBEDDED_SIGNUP_COMPLETED' as OnboardingStatus,
    onboarding_step: 'EMBEDDED_SIGNUP_COMPLETED' as OnboardingStatus,
    is_active: true,
    failure_reason: null,
    permissions_verified: false,
    webhook_verified: false,
    coexistence_enabled: false,
    created_by: input.created_by,
  }

  const existing = await getWhatsAppConfig(admin)
  if (existing) {
    const { data, error } = await admin
      .from(TABLE)
      .update(row)
      .eq('id', SINGLETON_ID)
      .select('*')
      .single()
    if (error) return null
    return data as WhatsAppConfig
  }

  const { data, error } = await admin.from(TABLE).insert(row).select('*').single()
  if (error) return null
  return data as WhatsAppConfig
}

export async function updateWhatsAppConfig(
  patch: Partial<WhatsAppConfig>,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { error } = await admin
    .from(TABLE)
    .update(patch)
    .eq('id', SINGLETON_ID)
  return !error
}

export async function markSignupInProgress(
  createdBy: string,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  const existing = await getWhatsAppConfig(admin)
  if (existing) {
    await admin
      .from(TABLE)
      .update({
        status: 'EMBEDDED_SIGNUP_IN_PROGRESS',
        onboarding_step: 'EMBEDDED_SIGNUP_IN_PROGRESS',
        failure_reason: null,
      })
      .eq('id', SINGLETON_ID)
    return
  }
  await admin.from(TABLE).insert({
    id: SINGLETON_ID,
    status: 'EMBEDDED_SIGNUP_IN_PROGRESS',
    onboarding_step: 'EMBEDDED_SIGNUP_IN_PROGRESS',
    created_by: createdBy,
    is_active: false,
  })
}

export async function markFailed(
  reason: string,
  admin: SupabaseClient = supabaseAdmin(),
): Promise<void> {
  await admin
    .from(TABLE)
    .update({
      status: 'FAILED',
      onboarding_step: 'FAILED',
      failure_reason: reason,
      is_active: false,
    })
    .eq('id', SINGLETON_ID)
}

export async function disconnectWhatsApp(
  admin: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { error } = await admin
    .from(TABLE)
    .update({
      status: 'NOT_CONNECTED',
      onboarding_step: 'NOT_CONNECTED',
      is_active: false,
      access_token: null,
      verify_token: null,
      webhook_verified: false,
      permissions_verified: false,
      coexistence_enabled: false,
      failure_reason: null,
      phone_number_id: null,
      waba_id: null,
      business_id: null,
      last_test_message_id: null,
    })
    .eq('id', SINGLETON_ID)
  return !error
}
