import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Service-role Supabase client for endpoints that legitimately need
// to bypass RLS — currently the user-management routes under
// /api/users/* and the signup-open probe. Never import this from
// browser code.
//
// Mirrors the pattern in src/lib/automations/admin-client.ts but
// lives at the generic location the rest of the app expects.
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }
  return _adminClient
}
