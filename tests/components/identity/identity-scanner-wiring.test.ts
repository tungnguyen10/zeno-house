import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TenantQuickCreateDialog from '~/components/tenants/TenantQuickCreateDialog.vue'
import TenantForm, { type TenantFormData } from '~/components/tenants/TenantForm.vue'

vi.mock('~/composables/tenants/useTenantQuickCreate', async orig => ({
  ...(await orig<typeof import('~/composables/tenants/useTenantQuickCreate')>()),
  useTenantQuickCreate: () => ({ submitting: ref(false), submit: vi.fn() }),
}))

const scannerStub = defineComponent({
  props: ['purpose', 'currentValues', 'fields'],
  emits: ['apply'],
  template: '<div data-test="scanner-stub" />',
})
const modalStub = defineComponent({
  props: ['open', 'title'],
  template: '<section v-if="open"><slot /><footer><slot name="footer" /></footer></section>',
})
const inputStub = defineComponent({
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :aria-label="label" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})
const passthrough = defineComponent({ template: '<div><slot /></div>' })

beforeEach(() => vi.clearAllMocks())

describe('TenantQuickCreateDialog scanner wiring', () => {
  function mountDialog() {
    return mount(TenantQuickCreateDialog, {
      props: { open: true },
      global: {
        components: { IdentityScanner: scannerStub },
        stubs: { UiModal: modalStub, UiInput: inputStub, UiDatePicker: inputStub, UiAlert: passthrough, UiFormSection: passthrough },
      },
    })
  }

  it('shows the scanner only inside the document block', async () => {
    const wrapper = mountDialog()
    expect(wrapper.find('[data-test="scanner-stub"]').exists()).toBe(false)
    await wrapper.find('[data-test="qc-toggle-id"]').trigger('click')
    expect(wrapper.find('[data-test="scanner-stub"]').exists()).toBe(true)
  })

  it('offers only the fields the dialog can hold and writes applied values into the form', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-test="qc-toggle-id"]').trigger('click')
    const scanner = wrapper.findComponent(scannerStub)
    expect(scanner.props('purpose')).toBe('tenant')
    expect(scanner.props('fields')).not.toContain('gender')
    expect(scanner.props('fields')).toContain('permanent_address')
    scanner.vm.$emit('apply', { full_name: 'NGUYỄN VĂN MẪU', id_number: '001099000000' })
    await wrapper.vm.$nextTick()
    expect((wrapper.find('[data-test="qc-name"]').element as HTMLInputElement).value).toBe('NGUYỄN VĂN MẪU')
    expect(scanner.props('currentValues')).toMatchObject({ full_name: 'NGUYỄN VĂN MẪU', id_number: '001099000000' })
  })
})

describe('TenantForm scanner wiring', () => {
  const data = (overrides: Partial<TenantFormData> = {}): TenantFormData => ({
    full_name: '', phone: '', email: '', id_number: '', date_of_birth: '', permanent_address: '',
    notes: '', gender: '', occupation: '', id_issued_date: '', id_issued_place: '',
    emergency_contact_name: '', emergency_contact_phone: '', ...overrides,
  })

  function mountForm(modelValue: TenantFormData) {
    return mount(TenantForm, {
      props: { modelValue },
      global: {
        components: { IdentityScanner: scannerStub },
        stubs: {
          UiInput: inputStub, UiDatePicker: inputStub, UiSelect: inputStub, UiTextarea: inputStub,
          UiFileUpload: passthrough, UiFormSection: passthrough,
        },
      },
    })
  }

  it('merges applied values into the model and offers gender', () => {
    const wrapper = mountForm(data({ phone: '0901234567' }))
    const scanner = wrapper.findComponent(scannerStub)
    expect(scanner.props('purpose')).toBe('tenant')
    expect(scanner.props('fields')).toContain('gender')
    scanner.vm.$emit('apply', { gender: 'male', id_number: '001099000000' })
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ phone: '0901234567', gender: 'male', id_number: '001099000000' })
  })

  it('does not treat the default issuing place as manual input', () => {
    const place = 'Cục Cảnh Sát Quản Lý Hành Chính Về Trật Tự Xã Hội'
    const scanner = mountForm(data({ id_issued_place: place })).findComponent(scannerStub)
    expect(scanner.props('currentValues').id_issued_place).toBe('')
    const typed = mountForm(data({ id_issued_place: 'Công an Hà Nội' })).findComponent(scannerStub)
    expect(typed.props('currentValues').id_issued_place).toBe('Công an Hà Nội')
  })
})
