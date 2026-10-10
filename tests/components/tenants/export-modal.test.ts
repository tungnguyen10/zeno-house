import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantExportModal from '../../../app/components/tenants/TenantExportModal.vue'

const fetchMock = vi.hoisted(() => vi.fn())
const downloadMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.mock('../../../app/composables/useExportDownload', () => ({
  useExportDownload: () => ({ downloadBlob: downloadMock }),
}))

const buildingId = '0a8a4dd0-7d6f-4f4e-bc7e-3c5e1b833333'

const stubs = {
  UiModal: defineComponent({
    props: ['open', 'title'],
    setup(props, { slots }) {
      return () => props.open ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null
    },
  }),
  UiSelect: defineComponent({
    props: ['modelValue', 'options', 'label'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('select', { 'aria-label': props.label, onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value) }, [
        h('option', { value: '' }, 'Chọn tòa nhà'),
        ...(props.options as Array<{ value: string; label: string }>).map(o => h('option', { value: o.value }, o.label)),
      ])
    },
  }),
  UiSearchInput: defineComponent({
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup(_, { emit }) { return () => h('input', { type: 'search', onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }) },
  }),
  UiCheckbox: defineComponent({
    props: ['modelValue', 'ariaLabel'],
    emits: ['update:modelValue'],
    setup(props, { emit }) { return () => h('input', { type: 'checkbox', 'aria-label': props.ariaLabel, checked: props.modelValue, onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).checked) }) },
  }),
  UiButton: defineComponent({
    props: ['disabled'],
    setup(props, { slots, attrs }) { return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.()) },
  }),
  UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', {}, slots.default?.()) } }),
  UiSkeleton: defineComponent({ setup() { return () => h('div') } }),
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (url: string) => url === '/api/buildings'
    ? { data: [{ id: buildingId, name: 'Tòa A' }], meta: { totalPages: 1 } }
    : { data: [{ id: 't-1', code: 'A1', fullName: 'Nguyễn Văn A', phone: '0901', roomNumbers: ['101'], roles: ['primary'] }] })
})

describe('TenantExportModal', () => {
  it('requires a building and selected tenant before exporting', async () => {
    const wrapper = mount(TenantExportModal, { props: { open: true }, global: { stubs } })
    await flushPromises()
    expect(wrapper.find('button[data-test="export"]').attributes('disabled')).toBeDefined()
    await wrapper.find('select').setValue(buildingId)
    await flushPromises()
    expect(wrapper.text()).toContain('Nguyễn Văn A')
    await wrapper.find('input[aria-label="Chọn Nguyễn Văn A"]').setValue(true)
    await wrapper.find('button[data-test="export"]').trigger('click')
    await flushPromises()
    expect(downloadMock).toHaveBeenCalledWith('/api/tenants/export', 'tenants.xlsx', {
      method: 'POST', body: { building_id: buildingId, tenant_ids: ['t-1'] },
    })
  })

  it('shows a retry path instead of an empty roster after candidate loading fails', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/buildings') return { data: [{ id: buildingId, name: 'Tòa A' }], meta: { totalPages: 1 } }
      throw new Error('network')
    })
    const wrapper = mount(TenantExportModal, { props: { open: true }, global: { stubs } })
    await flushPromises()
    await wrapper.find('select').setValue(buildingId)
    await flushPromises()
    expect(wrapper.text()).toContain('Thử tải lại')
    expect(wrapper.text()).not.toContain('Chưa có khách đang ở')
  })
})
