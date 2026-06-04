import type { CustomField, WebhookFieldMappings } from '@/types'

/**
 * Resolve a dot-notation path against a value. Returns undefined
 * when any link in the path is missing. Examples:
 *   resolvePath({a:{b:1}}, 'a.b')   → 1
 *   resolvePath({a:{b:1}}, 'a.c')   → undefined
 *   resolvePath({a:[{x:1}]}, 'a.0.x') → 1
 *
 * Accepts an optional leading "$." which JSONPath-style users tend
 * to type — stripped silently.
 */
export function resolvePath(root: unknown, path: string): unknown {
  if (!path) return undefined
  const cleaned = path.startsWith('$.') ? path.slice(2) : path
  const parts = cleaned.split('.').filter(Boolean)
  let cur: unknown = root
  for (const p of parts) {
    if (cur == null) return undefined
    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

/**
 * Coerce a raw payload value into the right shape for a custom field.
 * Mirrors the behaviour of the in-app custom-field inputs:
 *   - number    → Number(val) or null when NaN
 *   - select    → String(val)
 *   - multi_select → array (split on ',' if a string is sent)
 *   - text/file → String(val)
 */
function coerceCustomField(field: CustomField, raw: unknown): unknown {
  if (raw == null || raw === '') return null
  switch (field.field_type) {
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'multi_select': {
      if (Array.isArray(raw)) return raw.map((v) => String(v))
      return String(raw).split(',').map((s) => s.trim()).filter(Boolean)
    }
    case 'select':
    case 'text':
    case 'file':
    default:
      return String(raw)
  }
}

/**
 * Coerce a raw value into the right shape for a *standard* deal field.
 *   - value → number (NaN → null)
 *   - expected_close_date → ISO date string (passthrough; we trust the sender)
 *   - everything else → string
 */
function coerceStandardDealField(slot: string, raw: unknown): unknown {
  if (raw == null || raw === '') return null
  if (slot === 'value') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return String(raw)
}

export interface MappedPayload {
  contact: {
    standard: {
      name?: string | null
      phone?: string | null
      email?: string | null
      company?: string | null
    }
    custom_data: Record<string, unknown>
  }
  deal: {
    standard: {
      title?: string | null
      value?: number | null
      notes?: string | null
      expected_close_date?: string | null
    }
    custom_data: Record<string, unknown>
  } | null
}

/**
 * Apply a webhook's field_mappings to an incoming JSON payload.
 *
 * Returns a `MappedPayload` with separated contact + (optional) deal
 * buckets ready to feed into the existing Supabase insert paths. The
 * `creates_deal` flag on the webhook decides whether the caller passes
 * `includeDeal=true`; we still parse the deal bucket either way so the
 * caller can decide.
 *
 * @param payload          The parsed incoming JSON body.
 * @param mappings         The webhook.field_mappings JSONB.
 * @param contactCustomFields   All contact custom fields (for type coercion).
 * @param dealCustomFields      All deal custom fields (for type coercion).
 * @param includeDeal      When false, the `deal` bucket is returned null.
 */
export function applyMapping(
  payload: unknown,
  mappings: WebhookFieldMappings,
  contactCustomFields: CustomField[],
  dealCustomFields: CustomField[],
  includeDeal: boolean,
): MappedPayload {
  const contactMap = mappings.contact ?? {}
  const dealMap = mappings.deal ?? {}

  const contactStd: MappedPayload['contact']['standard'] = {}
  const contactCustom: Record<string, unknown> = {}

  for (const [slot, path] of Object.entries(contactMap)) {
    if (!path) continue
    const raw = resolvePath(payload, path)
    if (raw === undefined) continue

    if (slot.startsWith('cf:')) {
      const fieldId = slot.slice(3)
      const field = contactCustomFields.find((f) => f.id === fieldId)
      if (field) {
        const coerced = coerceCustomField(field, raw)
        if (coerced !== null) contactCustom[fieldId] = coerced
      }
    } else if (slot === 'name' || slot === 'phone' || slot === 'email' || slot === 'company') {
      contactStd[slot] = raw == null || raw === '' ? null : String(raw)
    }
  }

  let dealBucket: MappedPayload['deal'] = null
  if (includeDeal) {
    const dealStd: NonNullable<MappedPayload['deal']>['standard'] = {}
    const dealCustom: Record<string, unknown> = {}

    for (const [slot, path] of Object.entries(dealMap)) {
      if (!path) continue
      const raw = resolvePath(payload, path)
      if (raw === undefined) continue

      if (slot.startsWith('cf:')) {
        const fieldId = slot.slice(3)
        const field = dealCustomFields.find((f) => f.id === fieldId)
        if (field) {
          const coerced = coerceCustomField(field, raw)
          if (coerced !== null) dealCustom[fieldId] = coerced
        }
      } else if (
        slot === 'title' ||
        slot === 'value' ||
        slot === 'notes' ||
        slot === 'expected_close_date'
      ) {
        const coerced = coerceStandardDealField(slot, raw)
        if (slot === 'value') {
          dealStd.value = coerced as number | null
        } else {
          ;(dealStd as Record<string, unknown>)[slot] = coerced
        }
      }
    }

    dealBucket = { standard: dealStd, custom_data: dealCustom }
  }

  return {
    contact: { standard: contactStd, custom_data: contactCustom },
    deal: dealBucket,
  }
}
