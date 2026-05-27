import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin-client'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import {
  decryptSecret,
  encryptSecret,
  generateSecret,
  secretPrefix,
} from '@/lib/integrations/secret'

// ============================================================
// GET /api/integrations/webhooks/[id]/secret
//
// Admin OR Owner. Decrypts and returns the stored raw secret.
// Managers must not see the secret — they get 403. This is the
// only way to retrieve a secret after creation; if it's lost,
// admins use POST to regenerate.
// ============================================================
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const { data, error } = await supabaseAdmin()
    .from('webhooks')
    .select('secret_encrypted')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  try {
    const secret = decryptSecret(data.secret_encrypted as string)
    return NextResponse.json({ secret })
  } catch (err) {
    console.error('[webhooks/secret] decrypt failed:', err)
    return NextResponse.json(
      { error: 'Stored secret is unreadable; regenerate it' },
      { status: 500 },
    )
  }
}

// ============================================================
// POST /api/integrations/webhooks/[id]/secret
//
// Admin only. Rolls a new secret, returns it once. The previous
// secret is irrecoverable from this moment on.
// ============================================================
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await requireRole(['admin'])
  if (isErrorResponse(caller)) return caller

  const { id } = await params
  const raw = generateSecret()
  const encrypted = encryptSecret(raw)
  const prefix = secretPrefix(raw)

  const { error } = await supabaseAdmin()
    .from('webhooks')
    .update({
      secret_encrypted: encrypted,
      secret_prefix: prefix,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('[webhooks/secret] update failed:', error.message)
    return NextResponse.json(
      { error: 'Failed to regenerate secret' },
      { status: 500 },
    )
  }

  return NextResponse.json({ secret: raw })
}
