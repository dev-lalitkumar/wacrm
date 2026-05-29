'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, Unplug, ExternalLink, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any
    fbAsyncInit: () => void
  }
}

interface WhatsAppStatus {
  connected: boolean
  phone_number_id: string | null
  waba_id: string | null
}

export function WhatsAppCoexistenceSection() {
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    connected: false,
    phone_number_id: null,
    waba_id: null,
  })
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const sessionInfoRef = useRef<{ phone_number_id?: string; waba_id?: string; access_token?: string } | null>(null)

  const appId = process.env.NEXT_PUBLIC_META_APP_ID

  // Load Facebook JS SDK
  useEffect(() => {
    if (!appId || typeof window === 'undefined') return
    if (document.getElementById('facebook-jssdk')) {
      setSdkLoaded(true)
      return
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        xfbml: true,
        version: 'v21.0',
      })
      setSdkLoaded(true)
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [appId])

  // Fetch existing WA config
  useEffect(() => {
    fetch('/api/meta/whatsapp/status')
      .then((r) => r.json())
      .then((data: { connected?: boolean; phone_number_id?: string | null; waba_id?: string | null }) => {
        if (data.connected && data.phone_number_id) {
          setWaStatus({
            connected: true,
            phone_number_id: data.phone_number_id,
            waba_id: data.waba_id ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  function launchEmbeddedSignup() {
    if (!window.FB) {
      toast.error('Facebook SDK not loaded. Please refresh the page.')
      return
    }

    setLaunching(true)

    // Subscribe to session info from embedded signup
    window.FB.Event.subscribe(
      'WhatsAppEmbeddedSignup.sessionInfoListener',
      (data: { phone_number_id?: string; waba_id?: string; access_token?: string }) => {
        sessionInfoRef.current = data
      },
    )

    window.FB.login(
      async (response: { authResponse?: { accessToken?: string } }) => {
        setLaunching(false)

        if (!response.authResponse?.accessToken) {
          toast.error('WhatsApp setup was cancelled or failed.')
          return
        }

        // Use session info if captured, otherwise use the access token from login
        const sessionInfo = sessionInfoRef.current
        const accessToken = sessionInfo?.access_token ?? response.authResponse.accessToken
        const phoneNumberId = sessionInfo?.phone_number_id
        const wabaId = sessionInfo?.waba_id

        if (!phoneNumberId || !wabaId) {
          toast.error('WhatsApp setup completed but phone number ID / WABA ID were not captured. Please check your Meta App configuration.')
          return
        }

        try {
          const res = await fetch('/api/meta/whatsapp/embedded-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone_number_id: phoneNumberId,
              waba_id: wabaId,
              access_token: accessToken,
            }),
          })
          if (!res.ok) throw new Error('Save failed')
          setWaStatus({ connected: true, phone_number_id: phoneNumberId, waba_id: wabaId })
          toast.success('WhatsApp Business account connected successfully!')
        } catch {
          toast.error('Failed to save WhatsApp configuration')
        }
      },
      {
        scope: 'whatsapp_business_management,whatsapp_business_messaging',
        extras: {
          feature: 'whatsapp_embedded_signup',
          setup: {
            solutionID: '',
          },
        },
      },
    )
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect WhatsApp? This will stop all inbound/outbound WhatsApp messaging.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setWaStatus({ connected: false, phone_number_id: null, waba_id: null })
      toast.success('WhatsApp disconnected')
    } catch {
      toast.error('Failed to disconnect WhatsApp')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <svg className="size-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
          WhatsApp Coexistence
        </CardTitle>
        <CardDescription>
          Connect an existing WhatsApp number (personal or Business App) to the Cloud API without losing your existing chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {waStatus.connected && waStatus.phone_number_id ? (
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="size-4 text-green-400" />
            <AlertTitle className="text-green-400">WhatsApp Connected</AlertTitle>
            <AlertDescription className="space-y-1 text-slate-300">
              <div>Phone Number ID: <code className="text-slate-200">{waStatus.phone_number_id}</code></div>
              {waStatus.waba_id && (
                <div>WABA ID: <code className="text-slate-200">{waStatus.waba_id}</code></div>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-slate-700 bg-slate-800/50">
            <AlertTriangle className="size-4 text-slate-400" />
            <AlertTitle className="text-slate-300">Not Connected</AlertTitle>
            <AlertDescription className="text-slate-400">
              Use the embedded signup below to connect your WhatsApp Business account.
            </AlertDescription>
          </Alert>
        )}

        {!appId && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="size-4 text-amber-400" />
            <AlertTitle className="text-amber-400">Not Configured</AlertTitle>
            <AlertDescription className="text-slate-300">
              Add <code className="rounded bg-slate-800 px-1 text-xs text-slate-200">NEXT_PUBLIC_META_APP_ID</code> to your environment variables.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={launchEmbeddedSignup}
            disabled={!sdkLoaded || !appId || launching}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {launching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            )}
            {waStatus.connected ? 'Reconnect WhatsApp' : 'Launch WhatsApp Setup'}
          </Button>

          {waStatus.connected && (
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              {disconnecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Unplug className="size-4" />
              )}
              Disconnect
            </Button>
          )}
        </div>

        {/* Coexistence setup guide */}
        <Accordion>
          <AccordionItem value="coexistence-guide" className="border-slate-800">
            <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
              What is WhatsApp Coexistence?
            </AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm text-slate-400">
              <p>
                Coexistence allows you to use the WhatsApp Cloud API while keeping the WhatsApp Business App active on the same number. Both can send and receive messages simultaneously.
              </p>
              <p className="font-medium text-slate-300">Requirements:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>WhatsApp Business App installed and actively used for ≥7 days</li>
                <li>Latest version of WhatsApp Business App</li>
                <li>Camera access for QR code scanning during setup</li>
                <li>Standard Business Verification is NOT supported</li>
                <li>Official Business Account (blue badge) is NOT supported</li>
              </ul>
              <a
                href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Official Coexistence docs
                <ExternalLink className="size-3" />
              </a>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
