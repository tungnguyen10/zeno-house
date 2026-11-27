import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractHandoverSection from '~/components/contracts/ContractHandoverSection.vue'

const fetchMock = vi.hoisted(() => vi.fn())
let allowed = true
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useAuthStore', () => ({ can: () => allowed }))
const item = { id: 'i1', name: 'Giường', quantity: 1, condition: 'good', unitValue: 200000, note: null, sortOrder: 0 }
const handover = { sourceContractId: 'c1', sourceContractCode: 'HD1', items: [item] }
const stubs = {
  InventoryItemsList: { props: ['items'], template: '<div>{{ items.map(i => i.name).join(",") }}</div>' },
  InventoryItemsEditor: { name: 'InventoryItemsEditor', props: ['modelValue', 'disabled', 'errors'], emits: ['update:modelValue'], template: '<div data-test="editor">{{ modelValue.map(i => i.name).join(",") }}</div>' },
  UiAlert: { template: '<div role="alert"><slot /></div>' },
  UiConfirmModal: { props: ['open', 'loading'], emits: ['confirm', 'cancel'], template: '<div v-if="open"><button data-test="confirm-room" :disabled="loading" @click="$emit(\'confirm\')">Thay danh sách</button><button data-test="cancel-room" @click="$emit(\'cancel\')">Hủy</button></div>' },
  IconSpinner: true,
}
async function setup(props = {}) {
  const w = mount(ContractHandoverSection, { props: { contractId: 'c1', roomId: 'r1', editable: true, locked: false, ...props }, global: { stubs } })
  await flushPromises()
  return w
}
beforeEach(() => {
  allowed = true
  fetchMock.mockReset().mockResolvedValue({ data: handover })
})

describe('ContractHandoverSection', () => {
  it('edits a detached draft and cancels without saving', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    w.getComponent({ name: 'InventoryItemsEditor' }).vm.$emit('update:modelValue', [])
    await w.get('[data-test="handover-cancel"]').trigger('click')
    expect(w.text()).toContain('Giường')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('previews room inventory only after confirmation and saves this contract', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    await w.get('[data-test="handover-from-room"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValueOnce({ data: [{ ...item, name: 'Tủ' }] })
    await w.get('[data-test="confirm-room"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/rooms/r1/inventory')
    expect(w.get('[data-test="editor"]').text()).toContain('Tủ')
    expect(fetchMock.mock.calls.filter(c => c[1]?.method === 'PUT')).toHaveLength(0)
    fetchMock.mockResolvedValueOnce({ data: { ...handover, items: [{ ...item, name: 'Tủ' }] } })
    await w.get('[data-test="handover-save"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/contracts/c1/handover-inventory', {
      method: 'PUT', body: { items: [{ name: 'Tủ', quantity: 1, condition: 'good', unit_value: 200000, note: null }] },
    })
    expect(w.find('[data-test="editor"]').exists()).toBe(false)
    expect(w.text()).toContain('Đã lưu nội thất bàn giao')
  })

  it('validates before saving and preserves failed drafts', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    const editor = w.getComponent({ name: 'InventoryItemsEditor' })
    editor.vm.$emit('update:modelValue', [{ name: '', quantity: 1, condition: 'good', unit_value: null, note: null }])
    await w.get('[data-test="handover-save"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('Tên không được trống')
    editor.vm.$emit('update:modelValue', [{ name: 'Tủ', quantity: 1, condition: 'good', unit_value: null, note: null }])
    fetchMock.mockRejectedValueOnce({ data: { error: { message: 'Không thể lưu' } } })
    await w.get('[data-test="handover-save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-test="editor"]').text()).toContain('Tủ')
    expect(w.text()).toContain('Không thể lưu')
  })

  it.each([{ locked: true }, { locked: null }, { editable: false }])('does not offer editing with %j', async (props) => {
    const w = await setup(props)
    expect(w.find('[data-test="handover-edit"]').exists()).toBe(false)
  })

  it('hides editing without update permission', async () => {
    allowed = false
    const w = await setup()
    expect(w.find('[data-test="handover-edit"]').exists()).toBe(false)
  })

  it('disables saving when documents become locked during editing', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    await w.setProps({ locked: true })
    expect(w.get('[data-test="handover-save"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('đã phát hành')
  })

  it('handles a server lock conflict without losing the draft', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    fetchMock.mockRejectedValueOnce({ data: { error: { message: 'Hợp đồng đã phát hành', details: { reason: 'CONTRACT_INVENTORY_LOCKED' } } } })
    await w.get('[data-test="handover-save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="editor"]').exists()).toBe(true)
    expect(w.get('[data-test="handover-save"]').attributes('disabled')).toBeDefined()
  })

  it('shows inherited source and empty state', async () => {
    const inherited = await setup({ contractId: 'c2' })
    expect(inherited.text()).toContain('Theo biên bản bàn giao của hợp đồng HD1')
    fetchMock.mockResolvedValueOnce({ data: { sourceContractId: null, sourceContractCode: null, items: [] } })
    const empty = await setup()
    expect(empty.text()).toContain('Không có dữ liệu bàn giao')
  })

  it('keeps the draft visible when importing room inventory fails', async () => {
    const w = await setup()
    await w.get('[data-test="handover-edit"]').trigger('click')
    await w.get('[data-test="handover-from-room"]').trigger('click')
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    await w.get('[data-test="confirm-room"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="confirm-room"]').exists()).toBe(false)
    expect(w.text()).toContain('Không tải được nội thất phòng')
    expect(w.get('[data-test="editor"]').text()).toContain('Giường')
  })

  it('does not clear renewed inventory into the predecessor fallback', async () => {
    const w = await setup({ renewed: true })
    await w.get('[data-test="handover-edit"]').trigger('click')
    w.getComponent({ name: 'InventoryItemsEditor' }).vm.$emit('update:modelValue', [])
    await w.get('[data-test="handover-save"]').trigger('click')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('Hợp đồng gia hạn')
  })

  it('shows a load failure with retry instead of an empty list', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    const w = await setup()
    expect(w.text()).toContain('Không tải được')
    expect(w.text()).not.toContain('Không có dữ liệu bàn giao')
    await w.get('[data-test="handover-retry"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Giường')
  })
})
