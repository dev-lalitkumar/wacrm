'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { FacebookPage } from '@/lib/meta/types'

interface Props {
  connected: boolean
  pages: FacebookPage[]
}

interface ChecklistState {
  subscribedCount: number
  formsCount: number
  readyFormsCount: number
  recentLeadCount: number
  loading: boolean
}

function StepRow({
  done,
  label,
  hint,
}: {
  done: boolean
  label: string
  hint?: string
}) {
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-green-400 mt-0.5" />
      ) : (
        <Circle className="size-4 shrink-0 text-slate-600 mt-0.5" />
      )}
      <div>
        <span className={done ? 'text-slate-200' : 'text-slate-400'}>{label}</span>
        {hint && !done && (
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        )}
      </div>
    </li>
  )
}

export function MetaSetupChecklist({ connected, pages }: Props) {
  const [state, setState] = useState<ChecklistState>({
    subscribedCount: 0,
    formsCount: 0,
    readyFormsCount: 0,
    recentLeadCount: 0,
    loading: true,
  })

  const load = useCallback(async () => {
    if (!connected) {
      setState({
        subscribedCount: 0,
        formsCount: 0,
        readyFormsCount: 0,
        recentLeadCount: 0,
        loading: false,
      })
      return
    }

    setState((prev) => ({ ...prev, loading: true }))
    const supabase = createClient()
    const subscribedIds = pages.filter((p) => p.is_subscribed).map((p) => p.id)

    let formsCount = 0
    let readyFormsCount = 0

    if (subscribedIds.length > 0) {
      const { data: forms } = await supabase
        .from('facebook_lead_forms')
        .select('id')
        .in('page_id', subscribedIds)

      formsCount = forms?.length ?? 0

      if (forms && forms.length > 0) {
        const formIds = forms.map((f) => f.id)
        const { data: mappings } = await supabase
          .from('facebook_field_mappings')
          .select('form_id, crm_field')
          .in('form_id', formIds)

        const readyByForm = new Map<string, { phone: boolean; email: boolean }>()
        for (const m of mappings ?? []) {
          const entry = readyByForm.get(m.form_id) ?? { phone: false, email: false }
          if (m.crm_field === 'phone') entry.phone = true
          if (m.crm_field === 'email') entry.email = true
          readyByForm.set(m.form_id, entry)
        }
        readyFormsCount = [...readyByForm.values()].filter((v) => v.phone || v.email).length
      }
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('inbound_events')
      .select('*', { count: 'exact', head: true })
      .eq('source_type', 'meta_leadgen')
      .eq('status', 'success')
      .gte('received_at', since)

    setState({
      subscribedCount: subscribedIds.length,
      formsCount,
      readyFormsCount,
      recentLeadCount: count ?? 0,
      loading: false,
    })
  }, [connected, pages])

  useEffect(() => {
    load()
  }, [load])

  const stepConnected = connected
  const stepSubscribed = state.subscribedCount > 0
  const stepForms = state.formsCount > 0
  const stepMapped = state.readyFormsCount > 0
  const stepReceiving = state.recentLeadCount > 0

  const isReady = stepConnected && stepSubscribed && stepForms && stepMapped

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          Lead Capture Setup
          {state.loading ? (
            <Loader2 className="size-4 animate-spin text-slate-500" />
          ) : isReady ? (
            <span className="text-xs font-normal text-green-400">Ready</span>
          ) : connected ? (
            <span className="text-xs font-normal text-amber-400">Setup incomplete</span>
          ) : null}
        </CardTitle>
        <CardDescription>
          Complete each step to automatically capture Facebook leads as contacts and deals.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 text-sm">
          <StepRow
            done={stepConnected}
            label="Facebook account connected"
            hint="Click Connect Facebook above"
          />
          <StepRow
            done={stepSubscribed}
            label="At least one Page subscribed to lead webhooks"
            hint="Toggle Subscribe on a Page below"
          />
          <StepRow
            done={stepForms}
            label="Lead forms synced from Meta"
            hint="Expand a subscribed Page — forms sync on subscribe or Refresh"
          />
          <StepRow
            done={stepMapped}
            label="Phone or email mapped on a form"
            hint="Map Fields on each form — required for leads to be saved"
          />
          <StepRow
            done={stepReceiving}
            label="Webhook received a lead (last 7 days)"
            hint="Submit a test lead in Meta Ads Manager after mapping fields"
          />
        </ol>
      </CardContent>
    </Card>
  )
}

export function useMetaLeadCaptureReady(connected: boolean, pages: FacebookPage[]) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!connected) {
      setReady(false)
      return
    }

    const subscribedIds = pages.filter((p) => p.is_subscribed).map((p) => p.id)
    if (subscribedIds.length === 0) {
      setReady(false)
      return
    }

    const supabase = createClient()
    void (async () => {
      const { data: forms } = await supabase
        .from('facebook_lead_forms')
        .select('id')
        .in('page_id', subscribedIds)

      if (!forms?.length) {
        setReady(false)
        return
      }

      const { data: mappings } = await supabase
        .from('facebook_field_mappings')
        .select('form_id, crm_field')
        .in('form_id', forms.map((f) => f.id))

      const readyByForm = new Map<string, boolean>()
      for (const m of mappings ?? []) {
        if (m.crm_field === 'phone' || m.crm_field === 'email') {
          readyByForm.set(m.form_id, true)
        }
      }
      setReady(readyByForm.size > 0)
    })()
  }, [connected, pages])

  return ready
}
