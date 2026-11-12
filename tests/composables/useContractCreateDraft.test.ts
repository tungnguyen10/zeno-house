import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); window.localStorage.clear() })

describe('useContractCreateDraft', () => {
  it('debounces PUT and clears legacy local drafts', async () => {
    window.localStorage.setItem('contract-form:create', '{"x":1}')
    fetchMock.mockResolvedValue({ data: { updatedAt: '2026-11-11T00:00:00Z' } })
    const { useContractCreateDraft } = await import('~/composables/contracts/useContractCreateDraft')
    const d = useContractCreateDraft()
    d.schedule({ room_id: 'a' } as never)
    d.schedule({ room_id: 'b' } as never)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'PUT', body: { payload: { room_id: 'b' } } })
    expect(window.localStorage.getItem('contract-form:create')).toBeNull()
  })
})
