import type { ProviderTemplate, CallStatus } from './types'

function getPath(obj: unknown, path: string): string | undefined {
  if (!obj || !path) return undefined
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  if (cur == null) return undefined
  return String(cur)
}

export function resolveWebhookField(payload: unknown, path: string | undefined): string | undefined {
  if (!path) return undefined
  // Support dot-notation paths like 'body.call_session_id'
  return getPath(payload, path)
}

export function mapCallStatus(raw: string | undefined, mapping: Record<string, CallStatus>): CallStatus {
  if (!raw) return 'initiated'
  return mapping[raw] ?? mapping[raw.toLowerCase()] ?? 'initiated'
}

export const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
  deetyasoft: {
    name: 'DeetyaSoft',
    providerKey: 'deetyasoft',
    webhookIdentifier: 'deetyasoft',
    requestMethod: 'GET',
    buildUrl: (config, agentPhone, contactPhone, agentEmail) => {
      const base = 'https://api.dndfilter.com/api/clickToCall/generateCall'
      const p = new URLSearchParams({
        apiKey: config.apiKey ?? '',
        executiveContact: agentPhone,
        clientContact: contactPhone,
        executiveEmailId: agentEmail,
      })
      return `${base}?${p.toString()}`
    },
    buildHeaders: () => ({}),
    buildBody: () => null,
    parseCallResponse: (body) => {
      const b = body as Record<string, unknown> | null
      return { providerCallId: b?.call_id ? String(b.call_id) : null }
    },
    webhookMapping: {
      providerCallIdPath: 'call_session_id',
      statusPath: 'call_status',
      durationPath: 'call_duration',
      recordingUrlPath: 'recording_url',
      fromNumberPath: 'executive_number',
      toNumberPath: 'client_number',
    },
    statusMapping: {
      Answer: 'completed',
      'No Answer': 'no_answer',
      Busy: 'busy',
      Failed: 'failed',
      Cancel: 'canceled',
      Ringing: 'ringing',
    },
    configFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'text',
        placeholder: 'Enter your DeetyaSoft API Key',
        required: true,
      },
    ],
  },

  tata_tele: {
    name: 'Tata Tele (SmartFlo)',
    providerKey: 'tata_tele',
    webhookIdentifier: 'tata-tele',
    requestMethod: 'POST',
    buildUrl: () => 'https://api-smartflo.tatateleservices.com/v1/click_to_call',
    buildHeaders: (config) => ({
      Authorization: `Bearer ${config.bearerToken ?? ''}`,
      'Content-Type': 'application/json',
    }),
    buildBody: (config, agentPhone, contactPhone) => ({
      agent_number: agentPhone,
      destination_number: contactPhone,
      caller_id: config.callerId ?? '',
    }),
    parseCallResponse: (body) => {
      const b = body as Record<string, unknown> | null
      return { providerCallId: b?.call_id ? String(b.call_id) : null }
    },
    webhookMapping: {
      providerCallIdPath: 'call_id',
      statusPath: 'status',
      durationPath: 'duration',
      recordingUrlPath: 'recording_url',
      callStartTimePath: 'start_time',
    },
    statusMapping: {
      answered: 'completed',
      completed: 'completed',
      'no-answer': 'no_answer',
      busy: 'busy',
      failed: 'failed',
      cancel: 'canceled',
    },
    configFields: [
      {
        key: 'bearerToken',
        label: 'API Bearer Token',
        type: 'password',
        placeholder: 'Enter your SmartFlo API token',
        required: true,
      },
      {
        key: 'callerId',
        label: 'Caller ID (Virtual Number)',
        type: 'text',
        placeholder: 'e.g. 08044xxx017',
        required: true,
      },
    ],
  },
}
