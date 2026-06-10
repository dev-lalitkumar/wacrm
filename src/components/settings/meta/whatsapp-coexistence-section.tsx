'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/**
 * Meta tab entry point — full coexistence flow lives under Settings → WhatsApp.
 */
export function WhatsAppCoexistenceSection() {
  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white">WhatsApp Coexistence</CardTitle>
        <CardDescription>
          Connect WhatsApp Business App numbers via Embedded Signup on the WhatsApp settings tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href="/settings?tab=whatsapp"
          className="inline-flex h-9 items-center justify-center rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700"
        >
          Open WhatsApp Setup
        </Link>
      </CardContent>
    </Card>
  )
}
