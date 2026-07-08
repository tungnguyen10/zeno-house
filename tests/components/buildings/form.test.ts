import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import BuildingForm from '../../../app/components/buildings/BuildingForm.vue'

vi.stubGlobal('$fetch', vi.fn())

const passThrough = (tag = 'div') => defineComponent({
  setup(_, { slots }) { return () => h(tag, {}, slots.default?.()) },
})

const inputStub = defineComponent({
  props: ['modelValue', 'id', 'label', 'error', 'placeholder', 'required', 'disabled'],
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
}

function baseData() {
  return {
    name: '',
    address: '',
    description: '',
    status: 'active' as const,
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
    electricityPricingType: 'per_kwh' as const,
    defaultElectricityRate: '',
    waterPricingType: 'per_m3' as const,
    defaultWaterRate: '',
    meterReadingDay: '',
    billingGenerationDay: '',
    paymentDueDay: '',
    gracePeriodDays: '',
  }
}

function mountForm(props: Partial<InstanceType<typeof BuildingForm>['$props']> = {}) {
  return mount(BuildingForm, {
    props: { modelValue: baseData(), ...props },
    global: { stubs },
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('BuildingForm', () => {
  it('renders four sections with the expected titles', () => {
    const wrapper = mountForm()
    const html = wrapper.html()
    expect(html).toContain('Thông tin cơ bản')
    expect(html).toContain('Chủ sở hữu')
    expect(html).toContain('Tính phí mặc định')
    expect(html).toContain('Lịch vận hành')
  })

  it('does not show inline errors until the field is touched', async () => {
    const wrapper = mountForm({
      errors: { name: ['Tên tòa nhà phải có ít nhất 2 ký tự'] },
    })
    expect(wrapper.find('[data-test="inline-error"]').exists()).toBe(false)

    const nameInput = wrapper.find('#bf-name')
    await nameInput.trigger('blur')
    await nextTick()

    expect(wrapper.text()).toContain('Tên tòa nhà phải có ít nhất 2 ký tự')
  })

  it('reveals inline errors after a submit attempt', async () => {
    const wrapper = mountForm({
      errors: {
        name: ['Tên tòa nhà phải có ít nhất 2 ký tự'],
        address: ['Địa chỉ phải có ít nhất 5 ký tự'],
      },
    })

    await wrapper.find('form').trigger('submit')
    await nextTick()

    const inlineErrors = wrapper.findAll('[data-test="inline-error"]')
    expect(inlineErrors.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Tên tòa nhà phải có ít nhất 2 ký tự')
    expect(wrapper.text()).toContain('Địa chỉ phải có ít nhất 5 ký tự')
  })

  it('does not emit submit while validation errors remain', async () => {
    const wrapper = mountForm({
      errors: { name: ['Tên tòa nhà phải có ít nhất 2 ký tự'] },
    })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit when no errors are present', async () => {
    const wrapper = mountForm({
      isDirty: true,
      modelValue: {
        ...baseData(),
        name: 'Toa moi',
        address: '123 Duong Nguyen Trai',
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
