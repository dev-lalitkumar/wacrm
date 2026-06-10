'use client'

import { useState, useCallback, useEffect } from 'react'
import { WhatsAppSetupWizard } from './whatsapp/whatsapp-setup-wizard'
import { WhatsAppHealthDashboard } from './whatsapp/whatsapp-health-dashboard'
import { WhatsAppFailurePanel } from './whatsapp/whatsapp-failure-panel'
import { WhatsAppEmbeddedSignup } from './whatsapp/whatsapp-embedded-signup'
import { WhatsAppConfig } from './whatsapp-config'

export function WhatsAppSettings() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [onboarding, setOnboarding] = useState<{
    status: string
    failure_reason: string | null
  }>({ status: 'NOT_CONNECTED', failure_reason: null })

  const loadOnboarding = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/onboarding-status')
      if (res.ok) {
        const data = await res.json()
        setOnboarding({
          status: data.status,
          failure_reason: data.failure_reason,
        })
      }
    } catch {
      // ignore
    }
  }, [])

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1)
    void loadOnboarding()
  }, [loadOnboarding])

  useEffect(() => {
    void loadOnboarding()
  }, [loadOnboarding])

  return (
    <div className="space-y-6 mt-4">
      <WhatsAppSetupWizard poll key={`wizard-${refreshKey}`} />
      <WhatsAppFailurePanel
        status={onboarding.status}
        failureReason={onboarding.failure_reason}
        onReverified={bump}
      />
      <WhatsAppEmbeddedSignup onComplete={bump} />
      <WhatsAppHealthDashboard key={`health-${refreshKey}`} />
      <WhatsAppConfig key={`manual-${refreshKey}`} onChanged={bump} />
    </div>
  )
}
