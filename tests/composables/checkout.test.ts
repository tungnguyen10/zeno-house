import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContractCheckout } from '../../app/composables/contracts/useContractCheckout'
import type { CheckoutBundle } from '../../app/types/checkout'

const fetchMock = vi.fn()
const bundle: CheckoutBundle = { enabled: true, checkout: null, depositHeld: 3000000, creditHeld: 0, statement: null, refunds: [], sources: [] }
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('apiFetch', fetchMock) })

describe('checkout requests', () => {
  it('reuses refund operation id on retry and generates a new id for an intentional subsequent record', async () => {
    const { actions } = useContractCheckout('HD-1')
    fetchMock.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValue({ data: bundle })
    const input = { amount: 500000, paid_at: '2026-10-01', payment_method: 'cash' }
    await expect(actions.refund(input)).rejects.toThrow('Lost response')
    await actions.refund(input)
    const first = fetchMock.mock.calls[0]![1].body
    const retry = fetchMock.mock.calls[1]![1].body
    expect(retry.operation_id).toBe(first.operation_id)
    await actions.refund(input)
    expect(fetchMock.mock.calls[2]![1].body.operation_id).not.toBe(first.operation_id)
  })
  it('uses a different id when a failed refund is edited', async () => {
    const { actions } = useContractCheckout('HD-1')
    fetchMock.mockRejectedValueOnce(new Error('Network')).mockResolvedValue({ data: bundle })
    await expect(actions.refund({ amount: 100, paid_at: '2026-10-01', payment_method: 'cash' })).rejects.toThrow()
    await actions.refund({ amount: 200, paid_at: '2026-10-01', payment_method: 'cash' })
    expect(fetchMock.mock.calls[1]![1].body.operation_id).not.toBe(fetchMock.mock.calls[0]![1].body.operation_id)
  })
  it('keeps the draft version on handover confirmation and consumes the returned ledger', async () => {
    const state = useContractCheckout('HD-1')
    state.bundle.value = { ...bundle, checkout: { id: 'x', contractId: 'c', buildingId: 'b', actualReturnDate: '2026-10-01', reason: 'Trả phòng', status: 'draft', electricity: null, water: null, updatedAt: '2026-10-01T00:00:00Z' } }
    fetchMock.mockResolvedValue({ data: { ...bundle, depositHeld: 2000000 } })
    await state.actions.confirmReturn()
    expect(fetchMock).toHaveBeenCalledWith('/api/contracts/HD-1/checkout/return', { method: 'POST', body: { expected_updated_at: '2026-10-01T00:00:00Z', operation_id: expect.any(String) } })
    expect(state.bundle.value?.depositHeld).toBe(2000000)
  })
})
