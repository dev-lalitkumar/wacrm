/**
 * Contact service — single source of truth for creating contacts in the DB.
 *
 * Called by:
 *   • POST /api/contacts  (UI form path, server-side, uses session client)
 *   • Webhook ingestion route (service-role admin client)
 *
 * Accepts any SupabaseClient so it works with both the SSR session client
 * and the service-role admin client without duplicating logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { dispatchNotification } from '@/lib/notifications/service'

export interface CreateContactInput {
  /** Raw phone number — normalised by the service. Required. */
  phone: string
  name?: string | null
  email?: string | null
  company?: string | null
  /** Required — caller must supply a valid source_id. Never NULL. */
  source_id: string
  assigned_to?: string | null
  custom_data?: Record<string, unknown>
  /**
   * auth.users UUID of the creating user.
   * NULL for webhook/automation inserts (allowed since migration 016).
   */
  user_id?: string | null
}

export interface CreateContactResult {
  id: string
}

/**
 * Insert a new contact row.
 *
 * Validates that source_id is present, normalises the phone number,
 * then inserts and returns the new row's id.
 *
 * Throws on DB error or missing required fields.
 */
export async function createContact(
  supabase: SupabaseClient,
  data: CreateContactInput,
  opts: { notify?: boolean } = {},
): Promise<CreateContactResult> {
  const notify = opts.notify ?? true
  if (!data.source_id) {
    throw new Error('createContact: source_id is required')
  }
  if (!data.phone?.trim()) {
    throw new Error('createContact: phone is required')
  }

  const normalizedPhone = normalizePhone(data.phone)

  const { data: row, error } = await supabase
    .from('contacts')
    .insert({
      phone: normalizedPhone,
      name: data.name ?? null,
      email: data.email ?? null,
      company: data.company ?? null,
      source_id: data.source_id,
      assigned_to: data.assigned_to ?? null,
      custom_data: data.custom_data ?? {},
      user_id: data.user_id ?? null,
    })
    .select('id')
    .single()

  if (error || !row) {
    throw new Error(`createContact: insert failed — ${error?.message ?? 'unknown error'}`)
  }

  // Send a welcome message to the new contact (any source). Fire-and-forget;
  // bulk/import paths pass { notify: false } to stay silent.
  if (notify) {
    dispatchNotification({ type: 'contact.welcome', contactId: row.id as string })
      .catch((err) => console.error('[createContact] welcome notify', err))
  }

  return { id: row.id as string }
}
