'use client'

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Unplug,
  RefreshCw,
  ExternalLink,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import type { FacebookConfigResponse } from '@/lib/meta/types'

interface Props {
  config: FacebookConfigResponse | null
  loading: boolean
  syncing: boolean
  disconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  onSync: () => void
}

function TokenExpiryBadge({ expiresAt }: { expiresAt: number | null }) {
  if (!expiresAt) return null
  const nowSec = Date.now() / 1000
  const daysLeft = Math.floor((expiresAt - nowSec) / 86400)
  const isExpired = expiresAt < nowSec

  if (isExpired) {
    return (
      <Badge variant="destructive" className="ml-2 text-xs">
        Token expired — lead capture still active, reconnect to sync new pages
      </Badge>
    )
  }
  if (daysLeft <= 7) {
    return (
      <Badge variant="destructive" className="ml-2 text-xs">
        Token expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — reconnect soon
      </Badge>
    )
  }
  return null
}

export function FacebookAccountSection({
  config,
  loading,
  syncing,
  disconnecting,
  onConnect,
  onDisconnect,
  onSync,
}: Props) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-slate-500" />
        </CardContent>
      </Card>
    )
  }

  const isConnected = config?.connected && config.status === 'connected'
  const isConfigured = config?.configured ?? false

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <svg className="size-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Facebook Account
        </CardTitle>
        <CardDescription>
          Connect your Facebook account to capture leads from your Facebook Pages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ── Connected state ───────────────────────────────── */}
        {isConnected && config && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-start gap-3">
              {/* Profile picture */}
              <div className="shrink-0">
                {config.fb_user_picture ? (
                  <img
                    src={config.fb_user_picture}
                    alt={config.fb_user_name ?? 'Facebook profile'}
                    className="size-12 rounded-full object-cover border-2 border-green-500/30"
                  />
                ) : (
                  <div className="size-12 rounded-full bg-[#1877F2]/20 border-2 border-[#1877F2]/30 flex items-center justify-center">
                    <User className="size-6 text-[#1877F2]" />
                  </div>
                )}
              </div>

              {/* Profile info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="size-4 shrink-0 text-green-400" />
                  <span className="font-semibold text-white">{config.fb_user_name}</span>
                  <TokenExpiryBadge expiresAt={config.token_expires_at} />
                </div>
                {config.fb_user_email && (
                  <p className="text-sm text-slate-400 mt-0.5">{config.fb_user_email}</p>
                )}
                <p className="text-sm text-slate-400 mt-0.5">
                  {config.page_count} page{config.page_count !== 1 ? 's' : ''} available
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-xs">
                  <span className="inline-flex size-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 font-medium">Lead capture active</span>
                  <span className="text-slate-500 hidden sm:inline">— page tokens never expire</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────── */}
        {config?.status === 'error' && (
          <Alert className="border-red-500/30 bg-red-500/5">
            <AlertTriangle className="size-4 text-red-400" />
            <AlertTitle className="text-red-400">Connection Error</AlertTitle>
            <AlertDescription className="text-slate-300">
              Facebook tokens may have expired. Please reconnect.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Disconnected state ────────────────────────────── */}
        {!isConnected && config?.status === 'disconnected' && isConfigured && (
          <Alert className="border-slate-700 bg-slate-800/50">
            <XCircle className="size-4 text-slate-400" />
            <AlertTitle className="text-slate-300">Disconnected</AlertTitle>
            <AlertDescription className="text-slate-400">
              Click &quot;Connect Facebook&quot; to authorize your account and start capturing leads.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Not configured ────────────────────────────────── */}
        {!isConfigured && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <AlertTriangle className="size-4 text-amber-400" />
            <AlertTitle className="text-amber-400">Not Configured</AlertTitle>
            <AlertDescription className="text-slate-300">
              Add{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">META_APP_ID</code>
              {' '}and{' '}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">META_APP_SECRET</code>
              {' '}to your environment variables first.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Action buttons ────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {isConnected ? (
            <>
              <Button
                onClick={onSync}
                disabled={syncing}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                {syncing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Re-sync Pages
              </Button>
              <Button
                onClick={onDisconnect}
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
            </>
          ) : (
            <Button
              onClick={onConnect}
              disabled={!isConfigured}
              className="bg-[#1877F2] text-white hover:bg-[#166FE5]"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Connect Facebook
            </Button>
          )}

          <a
            href="https://developers.facebook.com/docs/marketing-api/guides/lead-ads"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            Meta Lead Ads docs
            <ExternalLink className="size-3" />
          </a>
        </div>

        <p className="text-xs text-slate-500">
          Required permissions:{' '}
          <code className="text-slate-400">pages_show_list</code>,{' '}
          <code className="text-slate-400">pages_manage_metadata</code>,{' '}
          <code className="text-slate-400">leads_retrieval</code>,{' '}
          <code className="text-slate-400">pages_read_engagement</code>
        </p>
      </CardContent>
    </Card>
  )
}
