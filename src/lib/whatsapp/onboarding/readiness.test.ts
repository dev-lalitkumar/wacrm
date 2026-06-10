import { describe, it, expect } from 'vitest'
import { stepsFromStatus } from './state-machine'

describe('readiness step flags', () => {
  it('requires webhook and test message for READY step flag', () => {
    const before = stepsFromStatus('COEXISTENCE_VERIFIED')
    expect(before.webhook).toBe(false)
    expect(before.test_message).toBe(false)

    const after = stepsFromStatus('TEST_MESSAGE_SENT')
    expect(after.webhook).toBe(true)
    expect(after.test_message).toBe(true)
  })
})
