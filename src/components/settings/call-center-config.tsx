'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Unplug,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { PROVIDER_TEMPLATES } from '@/lib/telephony/providers'
import type { TelephonyProviderKey, TelephonyConfigResponse } from '@/lib/telephony/types'

const PROVIDERS = [
  {
    key: 'tata_tele' as TelephonyProviderKey,
    name: 'Tata Tele (SmartFlo)',
    description: 'Cloud telephony for enterprises with virtual numbers and call recording.',
    docsUrl: 'https://smartflo.tatateleservices.com/',
  },
  {
    key: 'deetyasoft' as TelephonyProviderKey,
    name: 'DeetyaSoft',
    description: 'Click-to-call and IVR solution for CRM integrations.',
    docsUrl: 'https://api.dndfilter.com/',
  },
]

export function CallCenterConfig() {
  const [configLoading, setConfigLoading] = useState(true)
  const [config, setConfig] = useState<TelephonyConfigResponse | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<TelephonyProviderKey | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/telephony/config')
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as TelephonyConfigResponse
      setConfig(data)
      if (data.configured && data.provider_key) {
        setSelectedProvider(data.provider_key)
      }
    } catch {
      setConfig(null)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const tpl = selectedProvider ? PROVIDER_TEMPLATES[selectedProvider] : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProvider) return
    setSaving(true)
    try {
      const res = await fetch('/api/telephony/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_key: selectedProvider, config: configValues }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      toast.success(`${tpl?.name} connected successfully`)
      await loadConfig()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect telephony provider? Click-to-call will stop working.')) return
    setDisconnecting(true)
    try {
      await fetch('/api/telephony/config', { method: 'DELETE' })
      toast.success('Telephony provider disconnected')
      setConfig(null)
      setSelectedProvider(null)
      setConfigValues({})
      await loadConfig()
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function copyWebhookUrl() {
    if (!config?.webhook_url) return
    await navigator.clipboard.writeText(config.webhook_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (configLoading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-slate-500" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Phone className="size-5 text-primary" />
            Call Center
          </CardTitle>
          <CardDescription>
            Connect a telephony provider to enable one-click calling directly from contact and deal pages.
            Calls are automatically logged with duration and inline recording playback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {config?.configured ? (
            <Alert className="border-green-500/30 bg-green-500/5">
              <CheckCircle2 className="size-4 text-green-400" />
              <AlertTitle className="text-green-400">Connected — {config.name}</AlertTitle>
              <AlertDescription className="text-slate-300">
                Click-to-call is active. Agents need their phone number set in Settings → Profile.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-slate-700 bg-slate-800/50">
              <XCircle className="size-4 text-slate-400" />
              <AlertTitle className="text-slate-300">Not Connected</AlertTitle>
              <AlertDescription className="text-slate-400">
                Select a provider below and enter your credentials to enable click-to-call.
              </AlertDescription>
            </Alert>
          )}

          {/* Webhook URL — show when connected */}
          {config?.configured && config.webhook_url && (
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">
                Webhook URL — paste this in your provider dashboard
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 truncate">
                  {config.webhook_url}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copyWebhookUrl}
                  className="shrink-0 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Provider selector */}
          <div className="space-y-2">
            <Label className="text-slate-300">Select Provider</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(p.key)
                    setConfigValues({})
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedProvider === p.key
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-200">{p.name}</span>
                    {selectedProvider === p.key && (
                      <CheckCircle2 className="size-4 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Config fields for selected provider */}
          {tpl && (
            <form onSubmit={handleSave} className="space-y-4">
              {tpl.configFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`telephony-${field.key}`} className="text-slate-300">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </Label>
                  <Input
                    id={`telephony-${field.key}`}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={configValues[field.key] ?? ''}
                    onChange={(e) =>
                      setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    disabled={saving}
                    required={field.required}
                  />
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Phone className="size-4" />
                  )}
                  {config?.configured ? 'Update Connection' : 'Connect Provider'}
                </Button>

                {config?.configured && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
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
            </form>
          )}
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white text-base">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion>
            <AccordionItem value="tata" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                Tata Tele (SmartFlo) Setup
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>1. Log in to your SmartFlo dashboard at{' '}
                  <a href="https://smartflo.tatateleservices.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                    smartflo.tatateleservices.com <ExternalLink className="size-3" />
                  </a>
                </p>
                <p>2. Go to <strong className="text-slate-200">Settings → API Access</strong> and copy your API Bearer Token.</p>
                <p>3. Find your virtual number (Caller ID) in <strong className="text-slate-200">Phone Numbers</strong>.</p>
                <p>4. In the webhook/callback settings, paste the Webhook URL shown above.</p>
                <p>5. Each agent must set their registered mobile number in <strong className="text-slate-200">Settings → Profile → Phone Number</strong>.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="deetyasoft" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                DeetyaSoft Setup
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>1. Contact DeetyaSoft support to get your API Key from your account dashboard.</p>
                <p>2. In your DeetyaSoft settings, configure the webhook callback URL to the Webhook URL shown above.</p>
                <p>3. Each agent must set their registered mobile number in <strong className="text-slate-200">Settings → Profile → Phone Number</strong>.</p>
                <p>4. The agent email used during click-to-call must match the email registered with DeetyaSoft.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                How Click-to-Call Works
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>1. Agent clicks the <strong className="text-slate-200">phone icon</strong> next to a contact's phone number.</p>
                <p>2. The provider calls the <strong className="text-slate-200">agent's phone first</strong>. Agent answers.</p>
                <p>3. Provider then connects the agent to the contact's number.</p>
                <p>4. When the call ends, the provider sends a webhook with duration, status, and recording.</p>
                <p>5. CRM automatically logs the call in the contact's activity history with an <strong className="text-slate-200">inline audio player</strong> for the recording.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
