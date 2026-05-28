"use client"

import { useEffect, useState } from 'react'

interface GmailStatus {
  connected: boolean
  configured: boolean
  email: string | null
  loading: boolean
}

/**
 * Lightweight hook that checks the Gmail connection status once.
 * Used by compose dialog, QuickFollowup, dashboard, and
 * deal/contact detail views to show/hide email features.
 */
export function useGmailStatus(): GmailStatus {
  const [status, setStatus] = useState<GmailStatus>({
    connected: false,
    configured: false,
    email: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/api/gmail/config')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (!cancelled) {
          setStatus({
            connected: data.connected ?? false,
            configured: data.configured ?? false,
            email: data.connected_email ?? null,
            loading: false,
          })
        }
      } catch {
        if (!cancelled) {
          setStatus({
            connected: false,
            configured: false,
            email: null,
            loading: false,
          })
        }
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [])

  return status
}
