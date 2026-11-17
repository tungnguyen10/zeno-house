import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingLessorProfileForm from '~/components/buildings/BuildingLessorProfileForm.vue'

const FieldStub = defineComponent({
  props: ['modelValue', 'label', 'error', 'type'],
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
}

const masked = {
  buildingId: 'b-1', lessorFullName: 'Nguyễn Văn A', lessorDateOfBirth: null, lessorPermanentAddress: null,
  lessorIdNumber: '*******8901', lessorIdIssuedDate: '2021-05-01', lessorIdIssuedPlace: 'Huế', lessorPhone: '0901234567',
  lessorEmail: null, lessorIdentityMasked: true, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1,
  noticeDays: 30, depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
}

describe('BuildingLessorProfileForm', () => {
  it('renders read-only masked view without a save button', () => {
    const w = mount(BuildingLessorProfileForm, {
      props: { profile: masked, canEdit: false, saving: false, error: null },
      global: { stubs },
    })
    expect(w.text()).toContain('*******8901')
    expect(w.text()).toContain('Ẩn với vai trò quản lý')
    expect(w.find('[data-test="lessor-profile-save"]').exists()).toBe(false)
  })

  it('emits only lessor keys (snake_case) on save', async () => {
    const w = mount(BuildingLessorProfileForm, {
      props: { profile: null, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    await w.find('[data-test="lessor-full-name"] input').setValue('Nguyễn Văn A')
    await w.find('[data-test="lessor-profile-save"]').trigger('click')
    const patch = w.emitted('save')![0]![0] as Record<string, unknown>
    expect(patch).toMatchObject({ lessor_full_name: 'Nguyễn Văn A' })
    expect(patch).not.toHaveProperty('notice_days')
    expect(patch).not.toHaveProperty('signed_copies')
  })
})
