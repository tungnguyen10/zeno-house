import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, createLatestApiRequest } from '../../app/utils/api-fetch'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares a request with the same explicit in-flight dedupe key', async () => {
    let resolveRequest: ((value: { data: string }) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<{ data: string }>((resolve) => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('$fetch', fetchMock)

    const first = apiFetch('/api/example', { dedupeKey: 'example:list' })
    const second = apiFetch('/api/example', { dedupeKey: 'example:list' })
    resolveRequest?.({ data: 'ok' })

    await expect(first).resolves.toEqual({ data: 'ok' })
    await expect(second).resolves.toEqual({ data: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds request defaults without retrying mutations', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ data: 'ok' })
    vi.stubGlobal('$fetch', fetchMock)

    await apiFetch('/api/example', { method: 'POST', body: { name: 'Example' } })

    expect(fetchMock).toHaveBeenCalledWith('/api/example', expect.objectContaining({
      method: 'POST',
      retry: 0,
      timeout: 15_000,
      headers: expect.any(Headers),
    }))
  })

  it('aborts a superseded request so it cannot win a newer search', async () => {
    const resolvers: Array<(value: { data: string }) => void> = []
    const fetchMock = vi.fn((_request: string, options: { signal?: AbortSignal }) => new Promise<{ data: string }>((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      })
      resolvers.push(resolve)
    }))
    vi.stubGlobal('$fetch', fetchMock)
    const latest = createLatestApiRequest()

    const stale = latest<{ data: string }>('/api/audit?q=old')
    const current = latest<{ data: string }>('/api/audit?q=new')
    resolvers[1]!({ data: 'newest' })

    await expect(stale).rejects.toMatchObject({ name: 'AbortError' })
    await expect(current).resolves.toEqual({ data: 'newest' })
    expect(fetchMock.mock.calls[0]?.[1].signal.aborted).toBe(true)
  })
})
