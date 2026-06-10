import { describe, it, expect, vi, beforeEach } from 'vitest'
import { recordInboundEvent } from './record'

function mockAdmin(overrides: {
  existingSuccess?: { id: string } | null
  recentPending?: { id: string } | null
  insertResult?: { id: string } | null
  insertError?: { code?: string; message: string } | null
}) {
  const chain = (result: unknown) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: result }),
          }),
          in: () => ({
            gte: () => ({
              maybeSingle: async () => ({ data: overrides.recentPending ?? null }),
            }),
          }),
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: async () => ({
          data: overrides.insertResult ?? null,
          error: overrides.insertError ?? null,
        }),
      }),
    }),
  })

  return {
    from: vi.fn(() => chain(overrides.existingSuccess ?? null)),
  } as never
}

describe('recordInboundEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns duplicate when a successful event exists for idempotency key', async () => {
    const admin = mockAdmin({ existingSuccess: { id: 'evt-existing' } })
    const result = await recordInboundEvent(admin, {
      sourceType: 'meta_leadgen',
      idempotencyKey: 'lead-1',
      rawBody: '{}',
      status: 'pending',
    })
    expect(result).toEqual({ eventId: 'evt-existing', duplicate: true })
  })

  it('inserts and returns new event id', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table !== 'inbound_events') throw new Error('unexpected table')
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
                in: () => ({
                  gte: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'evt-new' }, error: null }),
            }),
          }),
        }
      }),
    } as never

    const result = await recordInboundEvent(admin, {
      sourceType: 'integration_webhook',
      sourceRef: 'wh-1',
      rawBody: '{"x":1}',
      status: 'pending',
    })
    expect(result).toEqual({ eventId: 'evt-new' })
  })
})
