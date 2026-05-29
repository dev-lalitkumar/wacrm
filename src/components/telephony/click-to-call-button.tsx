'use client'

import { useState, useEffect } from 'react'
import { Phone, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  contactId: string
  dealId?: string | null
  phoneNumber: string
}

export function ClickToCallButton({ contactId, dealId, phoneNumber }: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [calling, setCalling] = useState(false)

  useEffect(() => {
    fetch('/api/telephony/config')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setConfigured(d.configured ?? false))
      .catch(() => setConfigured(false))
  }, [])

  if (configured === null || !phoneNumber) return null

  async function handleCall() {
    if (!configured) return
    setCalling(true)
    try {
      const res = await fetch('/api/telephony/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, deal_id: dealId ?? null }),
      })
      const data = (await res.json()) as { success?: boolean; message?: string; error?: string }

      if (!res.ok || !data.success) {
        toast.error(data.error ?? data.message ?? 'Call failed')
      } else {
        toast.success(data.message ?? 'Connecting call…', {
          description: 'Answer your phone when it rings.',
          duration: 6000,
        })
      }
    } catch {
      toast.error('Failed to initiate call')
    } finally {
      setCalling(false)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <button
            type="button"
            onClick={handleCall}
            disabled={!configured || calling}
            className={`inline-flex size-5 items-center justify-center rounded transition-colors ${
              configured
                ? 'text-slate-400 hover:text-primary hover:bg-primary/10 cursor-pointer'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            aria-label="Click to call"
          >
            {calling ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Phone className="size-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {configured
            ? `Call ${phoneNumber}`
            : 'Set up Call Center in Settings first'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
