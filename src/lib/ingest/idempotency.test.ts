import { describe, it, expect } from 'vitest'
import { integrationIdempotencyKey } from './idempotency'

describe('integrationIdempotencyKey', () => {
  it('uses X-Idempotency-Key header when provided', () => {
    const key = integrationIdempotencyKey('wh-1', '{"a":1}', 'my-key-123')
    expect(key).toBe('hdr:my-key-123')
  })

  it('hashes webhook id + body when no header', () => {
    const a = integrationIdempotencyKey('wh-1', '{"name":"Ada"}', null)
    const b = integrationIdempotencyKey('wh-1', '{"name":"Ada"}', null)
    const c = integrationIdempotencyKey('wh-2', '{"name":"Ada"}', null)
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^body:[a-f0-9]{64}$/)
  })
})
