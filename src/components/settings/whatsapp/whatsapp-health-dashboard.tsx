'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface HealthData {
  status: string
  onboarding_status: string
  phone_number: string | null
  display_name: string | null
  quality_rating: string | null
  messaging_limit_tier: string | null
  webhook_last_received_at: string | null
  token_last_verified_at: string | null
  last_inbound_message_at: string | null
  last_outbound_message_at: string | null
  webhook_stale: boolean
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

export function WhatsAppHealthDashboard() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/whatsapp/health')
      if (res.ok) setData((await res.json()) as HealthData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white">Connection Health</CardTitle>
            <CardDescription>Operational metrics for your WhatsApp integration.</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : !data ? (
          <p className="text-sm text-slate-500">No health data yet.</p>
        ) : (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-200 capitalize">{data.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Onboarding</dt>
              <dd className="text-slate-200">{data.onboarding_status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-slate-200">{data.phone_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Display name</dt>
              <dd className="text-slate-200">{data.display_name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Quality</dt>
              <dd className="text-slate-200">{data.quality_rating ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Messaging tier</dt>
              <dd className="text-slate-200">{data.messaging_limit_tier ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Webhook last received</dt>
              <dd className={data.webhook_stale ? 'text-amber-400' : 'text-slate-200'}>
                {fmt(data.webhook_last_received_at)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Token last verified</dt>
              <dd className="text-slate-200">{fmt(data.token_last_verified_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last inbound</dt>
              <dd className="text-slate-200">{fmt(data.last_inbound_message_at)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last outbound</dt>
              <dd className="text-slate-200">{fmt(data.last_outbound_message_at)}</dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
