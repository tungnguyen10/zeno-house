import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InventoryItemsEditor from '~/components/inventory/InventoryItemsEditor.vue'

const item = (name: string) => ({ name, quantity: 1, condition: 'good' as const, unit_value: 1000, note: null })

describe('InventoryItemsEditor', () => {
  it('adds and removes rows', async () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('Giường')] } })
    await w.find('[data-test="inventory-add"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toHaveLength(2)
    await w.find('[data-test="inventory-remove-0"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toEqual([])
  })

  it('shows total value', () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('A'), { ...item('B'), quantity: 2 }] } })
    expect(w.find('[data-test="inventory-total"]').text()).toContain('3.000')
  })

  it('shows error for a duplicate row', () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('Tủ'), item('tủ')], errors: { '1.name': '"tủ" bị trùng' } } })
    expect(w.text()).toContain('"tủ" bị trùng')
  })
})
