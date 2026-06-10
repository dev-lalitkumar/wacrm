'use client'

import { InboundEventsSection } from '@/components/settings/inbound-events-section'

export function WebhookLogsSection() {
  return (
    <InboundEventsSection
      sourceType="meta_leadgen"
      title="Leadgen Webhook Events"
      description="Every Facebook Lead Ads webhook hit is recorded here. Leads are processed within about a minute by the background worker."
    />
  )
}
