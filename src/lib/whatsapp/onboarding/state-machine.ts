import type { OnboardingStatus, OnboardingSteps } from './types'

const ORDER: OnboardingStatus[] = [
  'NOT_CONNECTED',
  'EMBEDDED_SIGNUP_IN_PROGRESS',
  'EMBEDDED_SIGNUP_COMPLETED',
  'ASSET_VERIFIED',
  'PERMISSIONS_VERIFIED',
  'COEXISTENCE_VERIFIED',
  'WEBHOOK_VERIFIED',
  'TEST_MESSAGE_SENT',
  'READY',
]

export function stepsFromStatus(status: OnboardingStatus): OnboardingSteps {
  const idx = ORDER.indexOf(status)
  const at = (step: OnboardingStatus) => {
    const stepIdx = ORDER.indexOf(step)
    return idx >= stepIdx && status !== 'FAILED' && status !== 'NOT_CONNECTED'
  }
  return {
    embedded_signup: at('EMBEDDED_SIGNUP_COMPLETED'),
    asset_verification: at('ASSET_VERIFIED'),
    permissions: at('PERMISSIONS_VERIFIED'),
    coexistence: at('COEXISTENCE_VERIFIED'),
    webhook: at('WEBHOOK_VERIFIED'),
    test_message: at('TEST_MESSAGE_SENT'),
  }
}

export function isTerminalStatus(status: OnboardingStatus): boolean {
  return status === 'READY' || status === 'FAILED'
}

export function canAdvance(from: OnboardingStatus, to: OnboardingStatus): boolean {
  if (from === 'FAILED' && to === 'EMBEDDED_SIGNUP_COMPLETED') return true
  if (from === to) return true
  if (to === 'FAILED' && from !== 'READY' && from !== 'FAILED') return true
  const fromIdx = ORDER.indexOf(from)
  const toIdx = ORDER.indexOf(to)
  if (fromIdx === -1 || toIdx === -1) return false
  return toIdx === fromIdx + 1
}

export function nextStepAfter(status: OnboardingStatus): OnboardingStatus | null {
  const idx = ORDER.indexOf(status)
  if (idx === -1 || idx >= ORDER.indexOf('READY')) return null
  return ORDER[idx + 1]
}
