import { NextResponse } from 'next/server'
import { requireRole, isErrorResponse } from '@/lib/auth/require-role'
import { disconnectWhatsApp } from '@/lib/whatsapp/onboarding/repository'

export async function POST() {
  const caller = await requireRole(['admin', 'owner'])
  if (isErrorResponse(caller)) return caller

  const ok = await disconnectWhatsApp()
  if (!ok) {
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
