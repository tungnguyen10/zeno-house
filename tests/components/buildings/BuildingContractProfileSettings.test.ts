import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingContractProfileSettings from '~/components/buildings/BuildingContractProfileSettings.vue'

const FieldStub = defineComponent({
  props: ['modelValue', 'label', 'error', 'type', 'numberMode', 'placeholder', 'hint', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', {}, [
      h('span', {}, String(props.label ?? '')),
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
    ])
  },
})

const SlotStub = defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } })

const stubs = {
  UiInput: FieldStub,
  UiAlert: SlotStub,
  UiFormSection: defineComponent({
    props: ['title', 'description'],
    setup(props, { slots }) {
      return () => h('section', {}, [h('h3', {}, String(props.title ?? '')), slots.default?.()])
    },
  }),
  UiDefinitionList: SlotStub,
  UiDefinitionItem: defineComponent({
    props: ['label'],
    setup(props, { slots }) {
      return () => h('div', {}, [h('dt', {}, String(props.label ?? '')), h('dd', {}, slots.default?.())])
    },
  }),
  UiButton: defineComponent({
    props: ['loading', 'disabled'],
    emits: ['click'],
    setup(props, { slots, emit, attrs }) {
      return () => h('button', { ...attrs, disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
    },
  }),
  NuxtLink: defineComponent({
    props: ['to'],
    setup(props, { slots }) { return () => h('a', { href: props.to }, slots.default?.()) },
  }),
}

const building = { id: 'b-1', name: 'Zeno', billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 } as never
const masked = {
  buildingId: 'b-1', lessorFullName: 'Nguyễn Văn A', lessorDateOfBirth: null, lessorPermanentAddress: null,
  lessorIdNumber: '*******8901', lessorIdIssuedDate: '2021-05-01', lessorIdIssuedPlace: 'Huế', lessorPhone: '0901234567',
  lessorIdentityMasked: true, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1, noticeDays: 30,
  depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
}

describe('BuildingContractProfileSettings', () => {
  it('shows the payment window sentence from building schedule', () => {
    const w = mount(BuildingContractProfileSettings, {
      props: { profile: null, building, canEdit: true, saving: false, error: null, editPath: '/x' },
      global: { stubs },
    })
    expect(w.text()).toContain('Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10')
  })

  it('renders read-only masked view for managers without a save button', () => {
    const w = mount(BuildingContractProfileSettings, {
      props: { profile: masked, building, canEdit: false, saving: false, error: null, editPath: '/x' },
      global: { stubs },
    })
    expect(w.text()).toContain('*******8901')
    expect(w.text()).toContain('Ẩn với vai trò quản lý')
    expect(w.find('[data-test="contract-profile-save"]').exists()).toBe(false)
  })

  it('emits snake_case input on save', async () => {
    const w = mount(BuildingContractProfileSettings, {
      props: { profile: null, building, canEdit: true, saving: false, error: null, editPath: '/x' },
      global: { stubs },
    })
    await w.find('[data-test="lessor-full-name"] input').setValue('Nguyễn Văn A')
    await w.find('[data-test="contract-profile-save"]').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ lessor_full_name: 'Nguyễn Văn A', signed_copies: 2, copies_per_party: 1 })
  })
})
