'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Mail,
  Unplug,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'unknown'

export function GmailConfig() {
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('unknown')
  const [configured, setConfigured] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [connectedAt, setConnectedAt] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/config')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setStatus(data.status ?? 'disconnected')
      setConfigured(data.configured ?? false)
      setConnectedEmail(data.connected_email ?? null)
      setConnectedAt(data.connected_at ?? null)
    } catch {
      setStatus('unknown')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Handle OAuth redirect params — one-shot per unique param value to avoid
  // double-firing caused by searchParams identity changing twice in Next 16.
  const handledOAuthParamRef = useRef<string | null>(null)

  useEffect(() => {
    const success = searchParams.get('gmail_success')
    const error = searchParams.get('gmail_error')
    const paramKey = success ?? error ?? null
    if (!paramKey || handledOAuthParamRef.current === paramKey) return
    handledOAuthParamRef.current = paramKey

    if (success === 'true') {
      toast.success('Gmail connected successfully!')
      // Delay to allow the OAuth callback DB write to commit before re-fetching.
      const t = setTimeout(() => { loadConfig() }, 600)
      return () => clearTimeout(t)
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied: 'You denied access to Gmail',
        missing_params: 'Missing OAuth parameters',
        invalid_state: 'Invalid security token — please try again',
        unauthorized: 'You need to be signed in',
        forbidden: 'Only Admins and Owners can connect Gmail',
        db_error: 'Failed to save configuration',
        unexpected: 'An unexpected error occurred',
      }
      toast.error(messages[error] ?? `OAuth error: ${error}`)
    }
  }, [searchParams, loadConfig])

  async function handleDisconnect() {
    if (!confirm('Disconnect Gmail? Email sending will stop working for all team members.')) {
      return
    }
    setDisconnecting(true)
    try {
      const res = await fetch('/api/gmail/config', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Gmail disconnected')
      await loadConfig()
    } catch {
      toast.error('Failed to disconnect Gmail')
    } finally {
      setDisconnecting(false)
    }
  }

  function handleConnect() {
    // Redirect to the OAuth initiation endpoint
    window.location.href = '/api/gmail/auth'
  }

  if (loading) {
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
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Mail className="size-5" />
            Gmail Integration
          </CardTitle>
          <CardDescription>
            Connect your Google Workspace or Gmail account to send emails
            directly from the CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          {status === 'connected' && connectedEmail && (
            <Alert className="border-primary/30 bg-primary/5">
              <CheckCircle2 className="size-4 text-primary" />
              <AlertTitle className="text-primary">Connected</AlertTitle>
              <AlertDescription className="text-slate-300">
                Sending emails as{' '}
                <span className="font-semibold text-white">{connectedEmail}</span>
                {connectedAt && (
                  <span className="text-slate-500">
                    {' · connected '}
                    {new Date(connectedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <Alert className="border-red-500/30 bg-red-500/5">
              <AlertTriangle className="size-4 text-red-400" />
              <AlertTitle className="text-red-400">Connection Error</AlertTitle>
              <AlertDescription className="text-slate-300">
                Gmail tokens may have been revoked. Please reconnect.
              </AlertDescription>
            </Alert>
          )}

          {status === 'disconnected' && !configured && (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="size-4 text-amber-400" />
              <AlertTitle className="text-amber-400">Not Configured</AlertTitle>
              <AlertDescription className="text-slate-300">
                Google OAuth credentials are not set up. Add{' '}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                  GOOGLE_CLIENT_ID
                </code>{' '}
                and{' '}
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
                  GOOGLE_CLIENT_SECRET
                </code>{' '}
                to your environment variables first.
              </AlertDescription>
            </Alert>
          )}

          {status === 'disconnected' && configured && (
            <Alert className="border-slate-700 bg-slate-800/50">
              <XCircle className="size-4 text-slate-400" />
              <AlertTitle className="text-slate-300">Disconnected</AlertTitle>
              <AlertDescription className="text-slate-400">
                Click &quot;Connect Gmail&quot; to authorize your business email account.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {status === 'connected' ? (
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
                Disconnect Gmail
              </Button>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={!configured}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Mail className="size-4" />
                Connect Gmail
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white text-base">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion>
            <AccordionItem value="step-1" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                1. Create a Google Cloud Project
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>
                  Go to the{' '}
                  <a
                    href="https://console.cloud.google.com/projectcreate"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console
                    <ExternalLink className="size-3" />
                  </a>{' '}
                  and create a new project (or select an existing one).
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-2" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                2. Enable the Gmail API
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>
                  In APIs &amp; Services &gt; Library, search for &quot;Gmail API&quot; and enable it.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-3" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                3. Configure OAuth Consent Screen
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>
                  Set User Type to &quot;Internal&quot; (for Google Workspace) or
                  &quot;External&quot; (for testing). Add the Gmail scopes:
                  <code className="mx-1 rounded bg-slate-800 px-1 text-xs text-slate-200">
                    gmail.send
                  </code>
                  and
                  <code className="mx-1 rounded bg-slate-800 px-1 text-xs text-slate-200">
                    gmail.readonly
                  </code>
                  .
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-4" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                4. Create OAuth Credentials
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>
                  Go to APIs &amp; Services &gt; Credentials &gt; Create Credentials &gt;
                  OAuth Client ID. Choose &quot;Web Application&quot;.
                </p>
                <p>
                  Add the authorized redirect URI:
                </p>
                <code className="block rounded bg-slate-800 px-2 py-1 text-xs text-slate-200 break-all">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/api/gmail/callback`
                    : 'https://your-crm.com/api/gmail/callback'}
                </code>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="step-5" className="border-slate-800">
              <AccordionTrigger className="text-sm text-slate-300 hover:text-white">
                5. Set Environment Variables
              </AccordionTrigger>
              <AccordionContent className="text-sm text-slate-400 space-y-2">
                <p>
                  Add these to your <code className="text-slate-200">.env.local</code>:
                </p>
                <pre className="rounded bg-slate-800 px-3 py-2 text-xs text-slate-200 overflow-x-auto">
                  {`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret`}
                </pre>
                <p>Restart the server, then click &quot;Connect Gmail&quot; above.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}
