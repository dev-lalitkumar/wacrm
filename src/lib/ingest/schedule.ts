import { after } from 'next/server'
import { processInboundEvent } from './processor'

/**
 * Process inbound events immediately after the HTTP response (Vercel Hobby-safe).
 * Cron remains a backup for failures or when `after` is unavailable.
 */
export function scheduleInboundEventProcessing(eventIds: string | string[]): void {
  const ids = (Array.isArray(eventIds) ? eventIds : [eventIds]).filter(Boolean)
  if (ids.length === 0) return

  const work = async () => {
    for (const eventId of ids) {
      try {
        await processInboundEvent(eventId)
      } catch (err) {
        console.error('[ingest/schedule] process failed:', eventId, err)
      }
    }
  }

  try {
    after(work())
  } catch {
    void work()
  }
}
