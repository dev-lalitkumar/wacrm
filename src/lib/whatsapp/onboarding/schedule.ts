import { after } from 'next/server'
import { runOnboardingPipeline } from './orchestrator'

export function scheduleOnboardingPipeline(): void {
  const work = async () => {
    try {
      await runOnboardingPipeline()
    } catch (err) {
      console.error('[whatsapp/onboarding] pipeline failed:', err)
    }
  }

  try {
    after(work())
  } catch {
    void work()
  }
}
