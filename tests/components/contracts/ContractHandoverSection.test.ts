import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ContractHandoverSection from '~/components/contracts/ContractHandoverSection.vue'
import InventoryItemsList from '~/components/inventory/InventoryItemsList.vue'
import UiSection from '~/components/ui/UiSection.vue'
import UiSurfacePanel from '~/components/ui/UiSurfacePanel.vue'
import UiSkeleton from '~/components/ui/UiSkeleton.vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
const global = { components: { InventoryItemsList, UiSection, UiSurfacePanel, UiSkeleton, UiAlert, UiBadge } }

describe('ContractHandoverSection', () => {
  it('notes when items come from the original contract', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ id: 'i', name: 'Tủ', quantity: 1, condition: 'good', unitValue: null, note: null, sortOrder: 0 }] } })
    const w = mount(ContractHandoverSection, { props: { contractId: 'c-3' }, global })
    await flushPromises()
    expect(w.text()).toContain('Theo biên bản bàn giao của hợp đồng hd-1')
  })

  it('shows empty state', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: null, sourceContractCode: null, items: [] } })
    const w = mount(ContractHandoverSection, { props: { contractId: 'c-1' }, global })
    await flushPromises()
    expect(w.text()).toContain('Không có dữ liệu bàn giao')
  })
})
