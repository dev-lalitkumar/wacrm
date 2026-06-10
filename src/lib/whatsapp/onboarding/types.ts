export const ONBOARDING_STATUSES = [
  'NOT_CONNECTED',
  'EMBEDDED_SIGNUP_IN_PROGRESS',
  'EMBEDDED_SIGNUP_COMPLETED',
  'ASSET_VERIFIED',
  'PERMISSIONS_VERIFIED',
  'COEXISTENCE_VERIFIED',
  'WEBHOOK_VERIFIED',
  'TEST_MESSAGE_SENT',
  'READY',
  'FAILED',
] as const

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number]

export type ConnectionType = 'embedded_signup' | 'manual'

export interface OnboardingSteps {
  embedded_signup: boolean
  asset_verification: boolean
  permissions: boolean
  coexistence: boolean
  webhook: boolean
  test_message: boolean
}

export interface WhatsAppConfig {
  id: number
  status: OnboardingStatus
  onboarding_step: OnboardingStatus
  connection_type: ConnectionType | null
  business_id: string | null
  waba_id: string | null
  phone_number_id: string | null
  phone_number: string | null
  display_name: string | null
  verified_name: string | null
  quality_rating: string | null
  messaging_limit_tier: string | null
  access_token: string | null
  token_type: string | null
  token_last_verified_at: string | null
  permissions_verified: boolean
  permissions_payload: Record<string, unknown>
  webhook_verified: boolean
  webhook_subscription_status: string | null
  webhook_last_received_at: string | null
  verify_token: string | null
  coexistence_enabled: boolean
  onboarding_test_phone: string | null
  last_test_message_id: string | null
  last_inbound_message_at: string | null
  last_outbound_message_at: string | null
  failure_reason: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SaveCredentialsInput {
  phone_number_id: string
  waba_id: string
  access_token: string
  connection_type: ConnectionType
  onboarding_test_phone: string
  verify_token?: string | null
  created_by: string
}

export interface VerificationResult {
  ok: boolean
  error?: string
}
