import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TenantQuickCreateDialog from '~/components/tenants/TenantQuickCreateDialog.vue'

const submit = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('~/composables/tenants/useTenantQuickCreate', async (orig) => ({
  ...(await orig<typeof import('~/composables/tenants/useTenantQuickCreate')>()),
  useTenantQuickCreate: () => ({ submitting: ref(false), submit }),
}))
vi.stubGlobal('$fetch', fetchMock)

const modalStub = defineComponent({
  props: ['open', 'title'],
  emits: ['close'],
  template: '<section v-if="open"><h2>{{ title }}</h2><slot /><footer><slot name="footer" /></footer></section>',
})
const inputStub = defineComponent({
  props: ['modelValue', 'label', 'error'],
  emits: ['update:modelValue'],
  template: '<div><label>{{ label }}</label><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><span v-if="error" class="err">{{ error }}</span></div>',
})
const dateStub = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const alertStub = defineComponent({ template: '<div><slot /></div>' })
const buttonStub = defineComponent({
  props: ['disabled', 'loading'],
  emits: ['click'],
  template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
})
const sectionStub = defineComponent({ props: ['title'], template: '<section><slot /></section>' })

const mountDialog = (props = {}) => mount(TenantQuickCreateDialog, {
  props: { open: true, ...props },
  global: { stubs: { UiModal: modalStub, UiInput: inputStub, UiDatePicker: dateStub, UiAlert: alertStub, UiButton: buttonStub, UiFormSection: sectionStub } },
})

beforeEach(() => vi.clearAllMocks())

describe('TenantQuickCreateDialog', () => {
  it('prefills and keeps ID section collapsed', () => {
    const w = mountDialog({ initialPhone: '0901234567' })
    expect((w.find('[data-test="qc-phone"] input').element as HTMLInputElement).value).toBe('0901234567')
    expect(w.find('[data-test="qc-id-number"]').exists()).toBe(false)
  })

  it('blocks submit without name', async () => {
    const w = mountDialog({ initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    expect(submit).not.toHaveBeenCalled()
    expect(w.text()).toContain('Họ tên không được trống')
  })

  it('emits created on success', async () => {
    submit.mockResolvedValue({ kind: 'created', tenant: { id: 't-1', code: 'c', fullName: 'A', phone: '0901234567' } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('created')![0]![0]).toMatchObject({ id: 't-1' })
  })

  it('offers existing tenant on duplicate and disables when busy', async () => {
    submit.mockResolvedValue({ kind: 'duplicate', existingTenantId: 't-9', fields: ['phone'] })
    fetchMock.mockResolvedValue({ data: { id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0901234567', status: 'active', hasActiveContract: true } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Trần B')
    expect(w.find('[data-test="qc-use-existing"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Khách đang ở theo hợp đồng khác')
  })

  it('uses existing tenant when free', async () => {
    submit.mockResolvedValue({ kind: 'duplicate', existingTenantId: 't-9', fields: ['id_number'] })
    fetchMock.mockResolvedValue({ data: { id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0909', status: 'active', hasActiveContract: false } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="qc-use-existing"]').trigger('click')
    expect(w.emitted('created')![0]![0]).toEqual({ id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0909' })
  })

  it('shows generic conflict without action', async () => {
    submit.mockResolvedValue({ kind: 'conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('liên hệ quản trị viên')
    expect(w.find('[data-test="qc-use-existing"]').exists()).toBe(false)
  })

  it('resets state when closed and reopened', async () => {
    const w = mountDialog({ initialName: 'A' })
    await w.setProps({ open: false })
    await w.setProps({ open: true, initialName: '' })
    expect((w.find('[data-test="qc-name"] input').element as HTMLInputElement).value).toBe('')
  })
})
