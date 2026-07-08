import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import TenantForm from '../../../app/components/tenants/TenantForm.vue'

vi.stubGlobal('$fetch', vi.fn())

const passThrough = (tag = 'div') => defineComponent({
  setup(_, { slots }) { return () => h(tag, {}, slots.default?.()) },
})

const inputStub = defineComponent({
  props: ['modelValue', 'id', 'label', 'error', 'placeholder', 'required', 'disabled', 'type'],
  emits: ['update:modelValue', 'blur'],
  setup(props, { emit }) {
    return () => h('div', {}, [
      h('label', { for: props.id, 'data-test': 'label' }, props.label),
      h('input', {
        id: props.id,
        'data-test': 'input',
        value: props.modelValue,
        placeholder: props.placeholder,
        disabled: props.disabled,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
        onBlur: () => emit('blur'),
      }),
      props.error
        ? h('p', { 'data-test': 'inline-error' }, props.error)
        : null,
    ])
  },
})

const stubs = {
  UiInput: inputStub,
  UiTextarea: inputStub,
  UiSelect: defineComponent({
    props: ['modelValue', 'options', 'label', 'disabled'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () => h('select', {
        'data-test': 'select',
        'value': props.modelValue,
        'onChange': (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
      }, (props.options ?? []).map((o: { value: string; label: string }) =>
        h('option', { value: o.value }, o.label),
      ))
    },
  }),
  UiButton: defineComponent({
    props: ['variant', 'type', 'loading', 'disabled', 'size'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', {
        type: props.type ?? 'button',
        disabled: props.disabled,
        'data-test': 'btn',
        onClick: () => emit('click'),
      }, slots.default?.())
    },
  }),
  UiAlert: passThrough('div'),
  IconAlertCircle: defineComponent({ template: '<span />' }),
  IconCheckCircle: defineComponent({ template: '<span />' }),
}

function baseData() {
  return {
    full_name: '',
    phone: '',
    email: '',
    id_number: '',
    date_of_birth: '',
    permanent_address: '',
    notes: '',
    gender: '',
    occupation: '',
    id_issued_date: '',
    id_issued_place: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  }
}

function mountForm(props: Partial<InstanceType<typeof TenantForm>['$props']> = {}) {
  return mount(TenantForm, {
    props: { modelValue: baseData(), ...props },
    global: { stubs },
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('TenantForm', () => {
  it('renders four numbered sections', () => {
    const wrapper = mountForm()
    const html = wrapper.html()
    expect(html).toContain('1. Thông tin cá nhân')
    expect(html).toContain('2. Giấy tờ tuỳ thân')
    expect(html).toContain('3. Liên hệ khẩn cấp')
    expect(html).toContain('4. Ghi chú')
  })

  it('does not show inline errors until the field is touched', async () => {
    const wrapper = mountForm({
      errors: { full_name: ['Họ tên phải có ít nhất 2 ký tự'] },
    })
    expect(wrapper.find('[data-test="inline-error"]').exists()).toBe(false)

    const input = wrapper.find('#tf-full-name')
    await input.trigger('blur')
    await nextTick()

    // After blur, an inline error appears (either from local validator or props)
    expect(wrapper.find('[data-test="inline-error"]').exists()).toBe(true)
  })

  it('reveals inline errors after a submit attempt', async () => {
    const wrapper = mountForm({
      errors: {
        full_name: ['Họ tên không được bỏ trống'],
        phone: ['SĐT không hợp lệ'],
      },
    })

    await wrapper.find('form').trigger('submit')
    await nextTick()

    const inlineErrors = wrapper.findAll('[data-test="inline-error"]')
    expect(inlineErrors.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Họ tên không được trống')
    expect(wrapper.text()).toContain('Số điện thoại không được trống')
  })

  it('does not emit submit while validation errors remain', async () => {
    const wrapper = mountForm({
      errors: { full_name: ['Họ tên không được bỏ trống'] },
    })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit when required fields are valid', async () => {
    const wrapper = mountForm({
      isDirty: true,
      modelValue: {
        ...baseData(),
        full_name: 'Nguyễn Văn A',
        phone: '0901234567',
      },
    })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('renders the draft banner when hasDraft is true', () => {
    const wrapper = mountForm({ hasDraft: true })
    expect(wrapper.find('[data-test="draft-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Khôi phục')
  })

  it('emits restore-draft and discard-draft from the draft banner', async () => {
    const wrapper = mountForm({ hasDraft: true })
    const buttons = wrapper.find('[data-test="draft-banner"]').findAll('button')
    const restore = buttons.find(b => b.text() === 'Khôi phục')!
    const discard = buttons.find(b => b.text() === 'Bỏ nháp')!

    await restore.trigger('click')
    await discard.trigger('click')

    expect(wrapper.emitted('restore-draft')).toHaveLength(1)
    expect(wrapper.emitted('discard-draft')).toHaveLength(1)
  })

  it('renders the mobile sticky save bar', () => {
    const wrapper = mountForm()
    expect(wrapper.find('[data-test="sticky-save-bar"]').exists()).toBe(true)
  })
})
