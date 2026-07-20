import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import BuildingInvoiceProfileSettings from '../../../app/components/buildings/BuildingInvoiceProfileSettings.vue'

const profile = {
  buildingId: 'building-1',
  bankName: 'VIB',
  accountHolder: 'NGUYỄN TUẤN ANH',
  accountNumber: '375675817',
  transferContentTemplate: '{building_code}-{room_number}-{invoice_code}-{period}',
  qrImageUrl: 'https://signed.example/qr.webp',
  logoImageUrl: 'https://signed.example/logo.webp',
  legacyBackfilledAt: '2026-07-20T00:00:00.000Z',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-20T00:00:00.000Z',
  updatedBy: 'owner-1',
}

const FieldStub = defineComponent({
  props: ['modelValue', 'label', 'readonly', 'disabled'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', {}, [
      h('span', {}, String(props.label ?? '')),
      h('input', {
        value: props.modelValue,
        readonly: props.readonly,
        disabled: props.disabled,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
    ])
  },
})

const stubs = {
  UiInput: FieldStub,
  UiTextarea: FieldStub,
  UiAlert: defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } }),
  UiButton: defineComponent({
    props: ['loading', 'disabled', 'variant'],
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () => h('button', { disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
    },
  }),
  UiSkeleton: defineComponent({ template: '<div data-test="skeleton" />' }),
  UiBadge: defineComponent({ setup(_, { slots }) { return () => h('span', slots.default?.()) } }),
  IconLogo: defineComponent({ template: '<span data-test="zeno-logo" />' }),
}

describe('BuildingInvoiceProfileSettings', () => {
  it('renders a read-only manager view with current QR and no save action', () => {
    const wrapper = mount(BuildingInvoiceProfileSettings, {
      props: { profile, canEdit: false, loading: false, saving: false, error: null },
      global: { stubs },
    })

    expect(wrapper.findAll('input')[0]!.element.value).toBe('VIB')
    expect(wrapper.text()).toContain('Chỉ chủ nhà và admin có thể cập nhật')
    expect(wrapper.get('[data-test="qr-preview"]').attributes('src')).toContain('qr.webp')
    expect(wrapper.findAll('button').some(button => button.text() === 'Lưu thay đổi')).toBe(false)
  })

  it('shows the first-configuration state and emits normalized save intent', async () => {
    const wrapper = mount(BuildingInvoiceProfileSettings, {
      props: { profile: null, canEdit: true, loading: false, saving: false, error: null },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Chưa cấu hình thông tin nhận tiền')
    expect(wrapper.text()).toContain('{invoice_code}')
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue(' VIB ')
    await inputs[1]!.setValue(' NGUYỄN TUẤN ANH ')
    await inputs[2]!.setValue(' 375675817 ')
    const qrInput = wrapper.get('input[type="file"][data-kind="qr"]')
    const qrFile = new File(['qr'], 'qr.webp', { type: 'image/webp' })
    Object.defineProperty(qrInput.element, 'files', { value: [qrFile], configurable: true })
    await qrInput.trigger('change')
    await wrapper.findAll('button').find(button => button.text() === 'Lưu thay đổi')!.trigger('click')

    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({
      bankName: 'VIB',
      accountHolder: 'NGUYỄN TUẤN ANH',
      accountNumber: '375675817',
      removeLogo: false,
      qrImage: qrFile,
    })
  })

  it('offers an explicit Zeno-logo reset without removing the QR', async () => {
    const wrapper = mount(BuildingInvoiceProfileSettings, {
      props: { profile, canEdit: true, loading: false, saving: false, error: null },
      global: { stubs },
    })

    await wrapper.findAll('button').find(button => button.text() === 'Dùng logo Zeno')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Lưu thay đổi')!.trigger('click')
    expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ removeLogo: true, qrImage: null })
  })
})
