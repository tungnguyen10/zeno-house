import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, nextTick } from 'vue'
import RoomForm, { type RoomFormData } from '../../../app/components/rooms/RoomForm.vue'

vi.stubGlobal('useFetch', vi.fn(() => ({
  data: ref({ data: [{ id: 'b-1', name: 'Toa A' }] }),
})))

const passThrough = (tag = 'div') => defineComponent({
  setup(_, { attrs, slots }) { return () => h(tag, attrs, slots.default?.()) },
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
        type: props.type ?? 'text',
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
        onBlur: () => emit('blur', new FocusEvent('blur')),
      }),
      props.error ? h('p', { 'data-test': 'inline-error' }, props.error) : null,
    ])
  },
})

const stubs = {
  IconAlertCircle: passThrough('span'),
  IconCheckCircle: passThrough('span'),
  UiInput: inputStub,
  UiTextarea: inputStub,
  UiSelect: defineComponent({
    props: ['modelValue', 'options', 'id', 'label', 'error'],
    emits: ['update:modelValue', 'blur'],
    setup(props, { emit }) {
      return () => h('div', {}, [
        h('label', { for: props.id }, props.label),
        h('select', {
          id: props.id,
          'data-test': 'select',
          value: props.modelValue,
          onChange: (e: Event) => emit('update:modelValue', (e.target as HTMLSelectElement).value),
          onBlur: () => emit('blur', new FocusEvent('blur')),
        }, (props.options ?? []).map((o: { value: string; label: string }) =>
          h('option', { value: o.value }, o.label),
        )),
        props.error ? h('p', { 'data-test': 'inline-error' }, props.error) : null,
      ])
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

function baseData(): RoomFormData {
  return {
    building_id: '0f63f970-2f65-4a5d-9e24-1c4aa58d5e4b',
    room_number: '101',
    floor: 1,
    status: 'available',
    monthly_rent: 3000000,
    area: '',
    description: '',
  }
}

function mountForm(props: Partial<InstanceType<typeof RoomForm>['$props']> = {}) {
  return mount(RoomForm, {
    props: { modelValue: baseData(), ...props },
    global: { stubs },
  })
}

beforeEach(() => { vi.clearAllMocks() })

describe('RoomForm', () => {
  it('renders four numbered sections', () => {
    const wrapper = mountForm()
    expect(wrapper.text()).toContain('Vị trí')
    expect(wrapper.text()).toContain('Trạng thái')
    expect(wrapper.text()).toContain('Giá thuê & diện tích')
    expect(wrapper.text()).toContain('Mô tả')
  })

  it('shows inline validation after blur', async () => {
    const wrapper = mountForm({
      modelValue: { ...baseData(), room_number: '' },
    })

    await wrapper.find('#rf-room-number').trigger('blur')
    await nextTick()

    expect(wrapper.text()).toContain('Số phòng không được trống')
  })

  it('shows inline errors after submit failure', async () => {
    const wrapper = mountForm({
      modelValue: { ...baseData(), room_number: '', monthly_rent: -1 },
    })

    await wrapper.find('form').trigger('submit')
    await nextTick()

    const inlineErrors = wrapper.findAll('[data-test="inline-error"]')
    expect(inlineErrors.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('Số phòng không được trống')
    expect(wrapper.text()).toContain('Giá thuê không được âm')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit when form is valid', async () => {
    const wrapper = mountForm({ isDirty: true })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('renders draft banner actions', async () => {
    const wrapper = mountForm({ hasDraft: true, draftSavedAt: '2026-06-27T00:00:00.000Z' })
    const banner = wrapper.find('[data-test="draft-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Khôi phục')

    const buttons = banner.findAll('button')
    await buttons.find(b => b.text() === 'Khôi phục')!.trigger('click')
    await buttons.find(b => b.text() === 'Bỏ qua')!.trigger('click')
    await buttons.find(b => b.text() === 'Xoá bản nháp')!.trigger('click')

    expect(wrapper.emitted('restore-draft')).toHaveLength(1)
    expect(wrapper.emitted('dismiss-draft')).toHaveLength(1)
    expect(wrapper.emitted('clear-draft')).toHaveLength(1)
  })

  it('renders the mobile sticky save bar', () => {
    const wrapper = mountForm()
    expect(wrapper.find('[data-test="sticky-save-bar"]').exists()).toBe(true)
  })
})
