export interface FacebookPage {
  id: string
  name: string
  category: string | null
  picture_url: string | null
  is_subscribed: boolean
  subscribed_at: string | null
  created_at: string
  updated_at: string
}

export interface FacebookLeadFormQuestion {
  key: string | null
  label: string | null
  type: string | null
}

export interface FacebookLeadForm {
  id: string
  page_id: string
  name: string
  questions: FacebookLeadFormQuestion[]
  created_at: string
  updated_at: string
}

export interface FieldMapping {
  id: string
  form_id: string
  fb_field_key: string
  crm_object: 'contact' | 'deal'
  crm_field: string
}

export interface FieldData {
  name: string
  values: string[]
}

export interface LeadgenWebhookEntry {
  id: string
  changes: Array<{
    field: string
    value: {
      leadgen_id: string
      page_id: string
      form_id: string
      ad_id?: string
      adgroup_id?: string
      created_time?: number
    }
  }>
}

export interface LeadgenWebhookPayload {
  object: string
  entry: LeadgenWebhookEntry[]
}

export type FacebookConfigStatus = 'connected' | 'disconnected' | 'error'

export interface FacebookConfigResponse {
  connected: boolean
  configured: boolean
  status: FacebookConfigStatus
  fb_user_name: string | null
  fb_user_email: string | null
  fb_user_picture: string | null
  token_expires_at: number | null
  page_count: number
}

export interface GraphPageResult {
  id: string
  name: string
  access_token: string
  category?: string
  picture?: { data: { url: string } }
}

export interface GraphLeadFormQuestion {
  key: string
  label: string
  type: string
}

export interface GraphLeadFormResult {
  id: string
  name: string
  questions?: GraphLeadFormQuestion[]
}

export interface GraphLeadData {
  id: string
  created_time: string
  form_id: string
  field_data: FieldData[]
}
