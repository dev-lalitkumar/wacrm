'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { FacebookAccountSection } from './meta/facebook-account-section'
import { FacebookPagesSection } from './meta/facebook-pages-section'
import { WhatsAppCoexistenceSection } from './meta/whatsapp-coexistence-section'
import { WebhookLogsSection } from './meta/webhook-logs-section'
import { DeletionRequestsSection } from './meta/deletion-requests-section'
import type { FacebookConfigResponse, FacebookPage } from '@/lib/meta/types'

export function MetaConfig() {
  const searchParams = useSearchParams()

  const [configLoading, setConfigLoading] = useState(true)
  const [config, setConfig] = useState<FacebookConfigResponse | null>(null)
  const [pages, setPages] = useState<FacebookPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/config')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = (await res.json()) as FacebookConfigResponse
      setConfig(data)
      return data
    } catch {
      setConfig(null)
      return null
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const loadPages = useCallback(async () => {
    setPagesLoading(true)
    try {
      const res = await fetch('/api/meta/pages/sync', { method: 'POST' })
      if (!res.ok) return
      const data = (await res.json()) as { pages: FacebookPage[] }
      setPages(data.pages ?? [])
    } catch {
      // Ignore — pages section will show empty state
    } finally {
      setPagesLoading(false)  // always runs — fixes loading stuck on error
    }
  }, [])

  // Load pages from DB without syncing
  const fetchPagesFromDb = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/pages/list')
      if (!res.ok) return
      const data = (await res.json()) as { pages: FacebookPage[] }
      setPages(data.pages ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    loadConfig().then((data) => {
      if (data?.connected) {
        fetchPagesFromDb()
      }
    })
  }, [loadConfig, fetchPagesFromDb])

  // Handle OAuth redirect params
  useEffect(() => {
    const success = searchParams.get('meta_success')
    const error = searchParams.get('meta_error')
    const errorDetail = searchParams.get('meta_error_detail')

    if (success === 'true') {
      toast.success('Facebook account connected successfully!')
      loadConfig().then((data) => {
        if (data?.connected) fetchPagesFromDb()
      })
    } else if (error) {
      const messages: Record<string, string> = {
        access_denied: 'You denied access to Facebook',
        missing_params: 'Missing OAuth parameters — Facebook did not return expected values',
        invalid_state: 'Security token mismatch — please try connecting again',
        cookie_error: 'Could not read session cookies',
        unauthorized: 'You need to be signed in',
        forbidden: 'Only Admins and Owners can connect Facebook',
        missing_env: 'Server is missing META_APP_ID or META_APP_SECRET env vars',
        token_exchange_failed: 'Facebook token exchange failed',
        user_info_failed: 'Could not fetch your Facebook profile',
        db_error: 'Database error — check that migration 024 has been applied',
        unexpected: 'An unexpected error occurred',
      }
      const baseMsg = messages[decodeURIComponent(error)] ?? `OAuth error: ${error}`
      // Show detail as description if available (comes from server logs)
      toast.error(baseMsg, {
        description: errorDetail ? decodeURIComponent(errorDetail) : undefined,
        duration: 10000,
      })
      // Also log to browser console so it's visible in DevTools
      console.error('[Meta OAuth] error:', error, errorDetail ? `— ${errorDetail}` : '')
    }
  }, [searchParams, loadConfig, fetchPagesFromDb])

  function handleConnect() {
    window.location.href = '/api/meta/auth'
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Facebook? This will remove all page subscriptions and field mappings.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/meta/config', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Facebook disconnected')
      setPages([])
      await loadConfig()
    } catch {
      toast.error('Failed to disconnect Facebook')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/meta/pages/sync', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      const data = (await res.json()) as { pages: FacebookPage[] }
      setPages(data.pages ?? [])
      toast.success('Pages synced successfully')
      await loadConfig()
    } catch {
      toast.error('Failed to sync pages')
    } finally {
      setSyncing(false)
    }
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
      <FacebookAccountSection
        config={config}
        loading={configLoading}
        syncing={syncing}
        disconnecting={disconnecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSync={handleSync}
      />

      {config?.connected && (
        <>
          {pagesLoading ? (
            <Card className="border-slate-800 bg-slate-900">
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-slate-500" />
              </CardContent>
            </Card>
          ) : (
            <FacebookPagesSection pages={pages} onPagesChange={setPages} />
          )}
        </>
      )}

      <WhatsAppCoexistenceSection />

      <WebhookLogsSection />

      <DeletionRequestsSection />
    </div>
  )
}
