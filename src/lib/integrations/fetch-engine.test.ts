import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the contact/deal services so the engine doesn't pull in Supabase /
// notification side-effects. createContact returns a stable id; createDeal is
// unused here (creates_deal=false) but must exist for the import to resolve.
const { createContact } = vi.hoisted(() => ({
  createContact: vi.fn(async () => ({ id: 'contact-1' })),
}))
vi.mock('@/lib/contacts/service', () => ({ createContact }))
vi.mock('@/lib/deals/service', () => ({
  createDeal: vi.fn(async () => ({ id: 'deal-1' })),
  deriveDealTitle: (_n: unknown, _p: unknown, fallback?: string) => fallback ?? 'Lead',
}))

import { pollSource, locateItems } from './fetch-engine'
import type { LeadFetchSource } from '@/types'

// ── Minimal chainable Supabase stub ─────────────────────────────
function chain(resolve: () => { data: unknown }) {
  const obj: Record<string, unknown> = {
    select: () => chain(resolve),
    eq: () => chain(resolve),
    is: () => chain(resolve),
    maybeSingle: () => chain(resolve),
    then: (onF: (v: { data: unknown }) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onF, onR),
  }
  return obj
}

/** A fake admin client with a stateful seen-refs ledger (per instance). */
function makeAdmin() {
  const seen = new Set<string>()
  let idc = 0
  return {
    seen,
    rpc: async () => ({ data: null, error: null }),
    from(table: string) {
      return {
        select: () => chain(() => ({ data: [] })),
        insert: () => chain(() => ({ data: null })),
        update: () => chain(() => ({ data: null })),
        delete: () => chain(() => ({ data: null })),
        upsert: (row: { ref_id: string }) =>
          chain(() => {
            if (table !== 'lead_fetch_seen_refs') return { data: [] }
            if (seen.has(row.ref_id)) return { data: [] } // duplicate ignored
            seen.add(row.ref_id)
            return { data: [{ id: `seen-${++idc}` }] }
          }),
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      text: async () => JSON.stringify(body),
    })),
  )
}

function source(overrides: Partial<LeadFetchSource> = {}): LeadFetchSource {
  return {
    id: 'src-1',
    name: 'Test Provider',
    source_id: 'source-uuid',
    is_active: true,
    creates_deal: false,
    endpoint_url: 'https://api.test/leads',
    http_method: 'GET',
    headers_encrypted: null,
    query_params: [],
    body_template: null,
    items_path: 'data',
    ref_id_path: '$.id',
    field_mappings: { contact: { name: 'name', phone: 'phone', email: 'email' } },
    poll_interval_minutes: 5,
    last_status: 'idle',
    round_robin_override: false,
    round_robin_member_ids: [],
    round_robin_last_index: -1,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

beforeEach(() => {
  createContact.mockClear()
})

describe('locateItems', () => {
  it('returns the body when no items_path', () => {
    expect(locateItems([{ a: 1 }], null)).toEqual([{ a: 1 }])
  })
  it('resolves a dot path to the array', () => {
    expect(locateItems({ data: { leads: [1, 2] } }, 'data.leads')).toEqual([1, 2])
  })
  it('returns null when the path is not an array', () => {
    expect(locateItems({ data: { leads: 'x' } }, 'data.leads')).toBeNull()
  })
})

describe('pollSource — dry run', () => {
  it('locates items, maps fields, and flags skip reasons without writing', async () => {
    mockFetchOnce({
      data: [
        { id: '1', name: 'Alice', phone: '111', email: '' },
        { id: '', name: 'Bob', phone: '222' }, // missing ref id
        { id: '4', name: 'Dave' }, // no phone/email
        { id: '3', name: 'Carol', email: 'carol@x.com' },
      ],
    })
    const admin = makeAdmin()
    const summary = await pollSource(admin, source(), { dryRun: true })

    expect(summary.items_fetched).toBe(4)
    expect(summary.preview).toHaveLength(4)
    expect(summary.preview![0]).toMatchObject({
      ref_id: '1',
      contact: { name: 'Alice', phone: '111' },
    })
    expect(summary.preview![0].skipped_reason).toBeUndefined()
    expect(summary.preview![1].skipped_reason).toMatch(/ref id/i)
    expect(summary.preview![2].skipped_reason).toMatch(/phone or email/i)
    // Nothing imported on a dry run.
    expect(createContact).not.toHaveBeenCalled()
    expect(admin.seen.size).toBe(0)
  })

  it('errors when items_path points at a non-array', async () => {
    mockFetchOnce({ data: { not: 'an array' } })
    const summary = await pollSource(makeAdmin(), source(), { dryRun: true })
    expect(summary.status).toBe('error')
    expect(summary.error_message).toMatch(/items_path/i)
  })
})

describe('pollSource — real run + ref-id dedup', () => {
  it('creates a contact per new ref, then skips them on re-poll', async () => {
    const admin = makeAdmin()
    const src = source()

    mockFetchOnce({
      data: [
        { id: '1', name: 'Alice', phone: '111' },
        { id: '2', name: 'Bob', phone: '222' },
      ],
    })
    const first = await pollSource(admin, src)
    expect(first.items_created).toBe(2)
    expect(first.items_skipped).toBe(0)
    expect(createContact).toHaveBeenCalledTimes(2)

    // Re-poll the SAME records (overlapping window): ref-id dedup ⇒ 0 created.
    mockFetchOnce({
      data: [
        { id: '1', name: 'Alice', phone: '111' },
        { id: '2', name: 'Bob', phone: '222' },
      ],
    })
    const second = await pollSource(admin, src)
    expect(second.items_created).toBe(0)
    expect(second.items_skipped).toBe(2)
    expect(createContact).toHaveBeenCalledTimes(2) // unchanged
  })

  it('counts items with no phone or email as failed', async () => {
    mockFetchOnce({ data: [{ id: '9', name: 'NoContact' }] })
    const summary = await pollSource(makeAdmin(), source())
    expect(summary.items_created).toBe(0)
    expect(summary.items_failed).toBe(1)
    expect(summary.status).toBe('partial')
  })
})
