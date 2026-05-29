export type TelephonyProviderKey = 'tata_tele' | 'deetyasoft'

export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'canceled'

export interface TelephonyProvider {
  id: string
  name: string
  provider_key: TelephonyProviderKey
  is_active: boolean
  webhook_identifier: string | null
  created_at: string
  updated_at: string
}

export interface TelephonyCallLog {
  id: string
  provider_call_id: string | null
  provider_id: string | null
  contact_id: string | null
  deal_id: string | null
  initiated_by: string | null
  from_number: string | null
  to_number: string | null
  status: CallStatus
  duration: number | null
  recording_url: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface ProviderConfigField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder?: string
  required: boolean
}

export interface TelephonyConfigResponse {
  configured: boolean
  provider_key: TelephonyProviderKey | null
  name: string | null
  webhook_identifier: string | null
  webhook_url: string | null
  configFields: ProviderConfigField[]
}

export interface ClickToCallRequest {
  contact_id: string
  deal_id?: string | null
}

export interface ProviderTemplate {
  name: string
  providerKey: TelephonyProviderKey
  webhookIdentifier: string
  requestMethod: 'GET' | 'POST'
  buildUrl: (config: Record<string, string>, agentPhone: string, contactPhone: string, agentEmail: string) => string
  buildHeaders: (config: Record<string, string>) => Record<string, string>
  buildBody: (config: Record<string, string>, agentPhone: string, contactPhone: string) => Record<string, unknown> | null
  parseCallResponse: (body: unknown) => { providerCallId: string | null }
  webhookMapping: {
    providerCallIdPath?: string
    statusPath?: string
    durationPath?: string
    recordingUrlPath?: string
    callStartTimePath?: string
    fromNumberPath?: string
    toNumberPath?: string
  }
  statusMapping: Record<string, CallStatus>
  configFields: ProviderConfigField[]
}
