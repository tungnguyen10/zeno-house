import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

describe('ContractHandoverSection', () => {
  it('notes when items come from the original contract', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ id: 'i', name: 'Tủ', quantity: 1, condition: 'good', unitValue: null, note: null, sortOrder: 0 }] } })
    const { default: C } = await import('~/components/contracts/ContractHandoverSection.vue')
    const w = mount(C, { props: { contractId: 'c-3' } })
    await flushPromises()
    expect(w.text()).toContain('Theo biên bản bàn giao của hợp đồng hd-1')
  })

  it('shows empty state', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: null, sourceContractCode: null, items: [] } })
    const { default: C } = await import('~/components/contracts/ContractHandoverSection.vue')
    const w = mount(C, { props: { contractId: 'c-1' } })
    await flushPromises()
    expect(w.text()).toContain('Không có dữ liệu bàn giao')
  })
})
