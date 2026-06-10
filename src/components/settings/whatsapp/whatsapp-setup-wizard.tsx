'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface OnboardingStatus {
  status: string
  steps: {
    embedded_signup: boolean
    asset_verification: boolean
    permissions: boolean
    coexistence: boolean
    webhook: boolean
    test_message: boolean
  }
  failure_reason: string | null
  is_ready: boolean
}

function StepRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-green-400 mt-0.5" />
      ) : (
        <Circle className="size-4 shrink-0 text-slate-600 mt-0.5" />
      )}
      <span className={done ? 'text-slate-200' : 'text-slate-400'}>{label}</span>
    </li>
  )
}

export function WhatsAppSetupWizard({ poll = false }: { poll?: boolean }) {
  const [data, setData] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/onboarding-status')
      if (!res.ok) return
      setData((await res.json()) as OnboardingStatus)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!poll || !data) return
    if (data.is_ready || data.status === 'FAILED') return
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [poll, data, load])

  const steps = data?.steps

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          WhatsApp Setup
          {loading ? (
            <Loader2 className="size-4 animate-spin text-slate-500" />
          ) : data?.is_ready ? (
            <span className="text-xs font-normal text-green-400">Ready</span>
          ) : data?.status === 'FAILED' ? (
            <span className="text-xs font-normal text-red-400">Failed</span>
          ) : data?.status !== 'NOT_CONNECTED' ? (
            <span className="text-xs font-normal text-amber-400">In progress</span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Complete each step before WhatsApp is fully operational.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          <StepRow done={!!steps?.embedded_signup} label="Meta signup / credentials saved" />
          <StepRow done={!!steps?.asset_verification} label="WABA & phone verified" />
          <StepRow done={!!steps?.permissions} label="Permissions verified" />
          <StepRow done={!!steps?.coexistence} label="Coexistence verified" />
          <StepRow done={!!steps?.webhook} label="Webhook receiving events" />
          <StepRow done={!!steps?.test_message} label="Test message delivered" />
          <StepRow done={!!data?.is_ready} label="Ready" />
        </ol>
      </CardContent>
    </Card>
  )
}
