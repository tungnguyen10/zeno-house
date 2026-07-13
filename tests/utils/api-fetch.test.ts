import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../../app/utils/api-fetch'

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
})
