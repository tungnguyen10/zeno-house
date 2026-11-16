import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear() })

const input = {
  room_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e61', tenant_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e62',
  start_date: '2026-12-01', end_date: '2027-11-30', monthly_rent: 3_000_000,
  handover_electricity_reading: 1, handover_water_reading: 1,
} as never

describe('useContractForm.submitCreate', () => {
  it('sends a stable request_id across retries and returns replayed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { id: 'c-1' }, meta: { replayed: true } })
    const { useContractForm } = await import('~/composables/contracts/useContractForm')
    const f = useContractForm({ draftKey: { mode: 'create' } })
    expect(await f.submitCreate(input)).toBeNull()
    const res = await f.submitCreate(input)
    expect(fetchMock.mock.calls[0]![1].body.request_id).toBe(fetchMock.mock.calls[1]![1].body.request_id)
    expect(res).toEqual({ contract: { id: 'c-1' }, replayed: true })
  })
})
