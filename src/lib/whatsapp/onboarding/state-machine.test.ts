import { describe, it, expect } from 'vitest'
import { stepsFromStatus, canAdvance, isTerminalStatus } from './state-machine'

describe('onboarding state machine', () => {
  it('marks steps complete based on status order', () => {
    const steps = stepsFromStatus('PERMISSIONS_VERIFIED')
    expect(steps.embedded_signup).toBe(true)
    expect(steps.asset_verification).toBe(true)
    expect(steps.permissions).toBe(true)
    expect(steps.coexistence).toBe(false)
  })

  it('allows advance to next step or FAILED', () => {
    expect(canAdvance('ASSET_VERIFIED', 'PERMISSIONS_VERIFIED')).toBe(true)
    expect(canAdvance('ASSET_VERIFIED', 'FAILED')).toBe(true)
    expect(canAdvance('ASSET_VERIFIED', 'READY')).toBe(false)
  })

  it('identifies terminal statuses', () => {
    expect(isTerminalStatus('READY')).toBe(true)
    expect(isTerminalStatus('FAILED')).toBe(true)
    expect(isTerminalStatus('WEBHOOK_VERIFIED')).toBe(false)
  })
})
