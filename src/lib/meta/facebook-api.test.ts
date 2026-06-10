import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { graphPaginatedRequest, getLeadFormsWithFallback } from './facebook-api'

describe('graphPaginatedRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows paging.next until all lead forms are collected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'form-1', name: 'Form A' }],
          paging: {
            next: 'https://graph.facebook.com/v21.0/page/leadgen_forms?after=cursor1',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'form-2', name: 'Form B' }],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const { data, error } = await graphPaginatedRequest<{ id: string; name: string }>(
      '/page123/leadgen_forms?fields=id,name&limit=100&access_token=token',
    )

    expect(error).toBeUndefined()
    expect(data).toHaveLength(2)
    expect(data.map((f) => f.id)).toEqual(['form-1', 'form-2'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns partial data and error when a later page fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'form-1', name: 'Form A' }],
            paging: {
              next: 'https://graph.facebook.com/v21.0/page/leadgen_forms?after=cursor1',
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: { message: 'Invalid OAuth access token', code: 190 } }),
        }),
    )

    const { data, error } = await graphPaginatedRequest<{ id: string }>(
      '/page/leadgen_forms?access_token=bad',
    )

    expect(data).toHaveLength(1)
    expect(error?.message).toContain('Invalid OAuth access token')
  })
})

describe('getLeadFormsWithFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retries with user token when page token returns zero forms', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'form-user', name: 'User Token Form', questions: [] }],
          }),
        }),
    )

    const result = await getLeadFormsWithFallback('page1', 'page-token', 'user-token')

    expect(result.tokenUsed).toBe('user')
    expect(result.forms).toHaveLength(1)
    expect(result.forms[0]?.id).toBe('form-user')
    expect(result.warning).toBeTruthy()
  })

  it('uses page token result without fallback when forms are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'form-page', name: 'Page Form', questions: [] }],
        }),
      }),
    )

    const result = await getLeadFormsWithFallback('page1', 'page-token', 'user-token')

    expect(result.tokenUsed).toBe('page')
    expect(result.forms).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
