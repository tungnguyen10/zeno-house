import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InventoryItemsList from '~/components/inventory/InventoryItemsList.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const global = { components: { UiBadge } }

describe('InventoryItemsList', () => {
  it('renders empty text', () => {
    const w = mount(InventoryItemsList, { props: { items: [], emptyText: 'Không có dữ liệu bàn giao' }, global })
    expect(w.text()).toContain('Không có dữ liệu bàn giao')
  })

  it('renders source note and condition labels', () => {
    const w = mount(InventoryItemsList, {
      props: {
        items: [{ id: 'i', name: 'Tủ', quantity: 1, condition: 'used', unitValue: null, note: null, sortOrder: 0 }],
        sourceNote: 'Theo biên bản bàn giao của hợp đồng hd-1',
      },
      global,
    })
    expect(w.text()).toContain('Đã qua sử dụng')
    expect(w.text()).toContain('hd-1')
  })
})
