'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FB: any
    fbAsyncInit: () => void
  }
}

interface Props {
  onComplete?: () => void
}

export function WhatsAppEmbeddedSignup({ onComplete }: Props) {
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const sessionInfoRef = useRef<{ phone_number_id?: string; waba_id?: string } | null>(null)

  const appId = process.env.NEXT_PUBLIC_META_APP_ID
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID

  useEffect(() => {
    if (!appId || typeof window === 'undefined') return
    if (document.getElementById('facebook-jssdk')) {
      setSdkLoaded(true)
      return
    }

    window.fbAsyncInit = () => {
      window.FB.init({ appId, xfbml: true, version: 'v21.0' })
      setSdkLoaded(true)
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/en_US/sdk.js'
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  }, [appId])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== 'https://www.facebook.com' &&
        event.origin !== 'https://web.facebook.com'
      ) {
        return
      }
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          sessionInfoRef.current = {
            phone_number_id: data.data?.phone_number_id,
            waba_id: data.data?.waba_id,
          }
        }
      } catch {
        // ignore
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function launchEmbeddedSignup() {
    if (!testPhone.trim()) {
      toast.error('Enter your test phone number (E.164) before connecting')
      return
    }
    if (!window.FB) {
      toast.error('Facebook SDK not loaded. Refresh the page.')
      return
    }
    if (!configId) {
      toast.error('Add NEXT_PUBLIC_META_CONFIG_ID to your environment.')
      return
    }

    sessionInfoRef.current = null
    setLaunching(true)

    window.FB.login(
      async (response: { authResponse?: { accessToken?: string } }) => {
        setLaunching(false)
        if (!response.authResponse?.accessToken) {
          toast.error('WhatsApp setup was cancelled or failed.')
          return
        }

        const phoneNumberId = sessionInfoRef.current?.phone_number_id
        const wabaId = sessionInfoRef.current?.waba_id
        if (!phoneNumberId || !wabaId) {
          toast.error('Phone number ID / WABA ID not captured from Meta.')
          return
        }

        try {
          const res = await fetch('/api/meta/whatsapp/embedded-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone_number_id: phoneNumberId,
              waba_id: wabaId,
              access_token: response.authResponse.accessToken,
              onboarding_test_phone: testPhone.trim(),
            }),
          })
          if (!res.ok) {
            const body = await res.json()
            throw new Error(body?.error ?? 'Save failed')
          }
          toast.success('Signup complete — verification running…')
          onComplete?.()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to save')
        }
      },
      {
        config_id: configId,
        response_type: 'token',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white">WhatsApp Coexistence (Embedded Signup)</CardTitle>
        <CardDescription>
          Connect an existing WhatsApp Business App number without losing chats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wa-test-phone" className="text-slate-300">
            Test phone number (E.164)
          </Label>
          <Input
            id="wa-test-phone"
            placeholder="+15551234567"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="border-slate-700 bg-slate-800"
          />
          <p className="text-xs text-slate-500">
            We send a test message to this number during setup.
          </p>
        </div>
        <Button
          onClick={launchEmbeddedSignup}
          disabled={!sdkLoaded || launching}
          className="bg-green-600 hover:bg-green-700"
        >
          {launching ? <Loader2 className="size-4 animate-spin" /> : null}
          Connect with Meta
        </Button>
        <a
          href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          Meta Embedded Signup docs <ExternalLink className="size-3" />
        </a>
      </CardContent>
    </Card>
  )
}
