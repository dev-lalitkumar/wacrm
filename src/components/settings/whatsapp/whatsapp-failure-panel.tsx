'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

interface Props {
  failureReason: string | null
  status: string
  onReverified?: () => void
}

export function WhatsAppFailurePanel({ failureReason, status, onReverified }: Props) {
  const [retrying, setRetrying] = useState(false)

  if (status !== 'FAILED' || !failureReason) return null

  async function handleReverify() {
    setRetrying(true)
    try {
      const res = await fetch('/api/whatsapp/reverify', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body?.error ?? 'Reverify failed')
        return
      }
      toast.success('Verification restarted')
      onReverified?.()
    } catch {
      toast.error('Network error')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Alert className="border-red-500/30 bg-red-500/5">
      <AlertTriangle className="size-4 text-red-400" />
      <AlertTitle className="text-red-400">Setup failed</AlertTitle>
      <AlertDescription className="space-y-3 text-slate-300">
        <p>{failureReason}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReverify}
          disabled={retrying}
          className="border-slate-600"
        >
          {retrying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          Retry verification
        </Button>
      </AlertDescription>
    </Alert>
  )
}
