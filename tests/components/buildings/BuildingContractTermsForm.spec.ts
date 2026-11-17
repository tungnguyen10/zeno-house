import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import BuildingContractTermsForm from '~/components/buildings/BuildingContractTermsForm.vue'

const FieldStub = defineComponent({
  props: ['modelValue', 'label', 'error', 'type', 'numberMode', 'placeholder', 'hint'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('label', {}, [
      h('span', {}, String(props.label ?? '')),
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      }),
      props.error ? h('span', { class: 'field-error' }, String(props.error)) : null,
    ])
  },
})

const SelectStub = defineComponent({
  props: ['modelValue', 'label', 'options'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('select', {
      value: props.modelValue,
      onChange: (event: Event) => emit('update:modelValue', (event.target as HTMLSelectElement).value),
    }, (props.options as { value: string; label: string }[] ?? []).map(opt => h('option', { value: opt.value }, opt.label)))
  },
})

const SlotStub = defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } })

const stubs = {
  UiInput: FieldStub,
  UiSelect: SelectStub,
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

function inputByLabel(w: VueWrapper, label: string) {
  const match = w.findAll('label').find(l => l.find('span').text() === label)
  if (!match) throw new Error(`label not found: ${label}`)
  return match.find('input')
}

const buildingWithSchedule = { id: 'b-1', name: 'Zeno', billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 } as never
const buildingIncomplete = { id: 'b-1', name: 'Zeno', billingGenerationDay: null, paymentDueDay: null, gracePeriodDays: 5 } as never

const savedProfile = {
  buildingId: 'b-1', lessorFullName: 'Nguyễn Văn A', lessorDateOfBirth: null, lessorPermanentAddress: null,
  lessorIdNumber: null, lessorIdIssuedDate: null, lessorIdIssuedPlace: null, lessorPhone: null, lessorEmail: null,
  lessorIdentityMasked: false, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1,
  noticeDays: 0, depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '2024-01-01T00:00:00Z', updatedBy: 'u-1',
}

describe('BuildingContractTermsForm', () => {
  it('prefills suggested values for a null profile', () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: null, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    expect(inputByLabel(w, 'Thời hạn (tháng)').element.value).toBe('12')
    expect(inputByLabel(w, 'Số ngày báo trước').element.value).toBe('30')
    expect(inputByLabel(w, 'Số ngày hoàn cọc').element.value).toBe('7')
    expect(inputByLabel(w, 'Số tháng tự gia hạn').element.value).toBe('6')
  })

  it('keeps stored zero values over suggestions', () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: savedProfile, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    expect(inputByLabel(w, 'Số ngày báo trước').element.value).toBe('0')
    expect(inputByLabel(w, 'Số tháng tự gia hạn').element.value).toBe('0')
  })

  it('shows the suggestion hint when a saved profile still has null suggested terms', () => {
    const w = mount(BuildingContractTermsForm, {
      props: {
        profile: { ...savedProfile, defaultTermMonths: null, noticeDays: null } as never,
        building: buildingWithSchedule, canEdit: true, saving: false, error: null,
      },
      global: { stubs },
    })
    expect(w.text()).toContain('Đã điền sẵn giá trị thường dùng. Xem lại rồi lưu.')
  })

  it('hides the suggestion hint once every suggested term is saved', () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: savedProfile as never, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    expect(w.text()).not.toContain('Đã điền sẵn giá trị thường dùng')
  })

  it('emits save with only terms keys and numeric values', async () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: null, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    await w.find('[data-test="contract-terms-save"]').trigger('click')
    const patch = w.emitted('save')![0]![0] as Record<string, unknown>
    expect(patch).not.toHaveProperty('lessor_full_name')
    expect(patch).not.toHaveProperty('lessor_id_number')
    expect(typeof patch.default_term_months).toBe('number')
    expect(typeof patch.notice_days).toBe('number')
  })

  it('sets deposit months via presets', async () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: null, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    await w.find('[data-test="deposit-preset-2"]').trigger('click')
    expect(inputByLabel(w, 'Số tháng cọc').element.value).toBe('2')
    await w.find('[data-test="contract-terms-save"]').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ default_deposit_months: 2 })
  })

  it('converts percent deposit input to months', async () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: null, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    await w.find('select').setValue('percent')
    await inputByLabel(w, 'Tiền cọc (%)').setValue('100')
    await w.find('[data-test="contract-terms-save"]').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ default_deposit_months: 1 })
  })

  it('shows a field error and does not emit when copies per party exceed signed copies', async () => {
    const violatingProfile = { ...savedProfile, signedCopies: 2, copiesPerParty: 2 }
    const w = mount(BuildingContractTermsForm, {
      props: { profile: violatingProfile, building: buildingWithSchedule, canEdit: true, saving: false, error: null },
      global: { stubs },
    })
    await w.find('[data-test="contract-terms-save"]').trigger('click')
    expect(w.text()).toContain('Tổng số bản hai bên giữ vượt quá số bản ký')
    expect(w.emitted('save')).toBeUndefined()
  })

  it('shows the payment window sentence to read-only viewers with a complete schedule', () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: savedProfile, building: buildingWithSchedule, canEdit: false, saving: false, error: null },
      global: { stubs },
    })
    expect(w.text()).toContain('Thanh toán từ ngày 1 đến ngày 5 hằng tháng')
    expect(w.find('[data-test="contract-terms-save"]').exists()).toBe(false)
  })

  it('shows the warning alert to read-only viewers when the schedule is incomplete', () => {
    const w = mount(BuildingContractTermsForm, {
      props: { profile: savedProfile, building: buildingIncomplete, canEdit: false, saving: false, error: null },
      global: { stubs },
    })
    expect(w.text()).toContain('Chưa đủ lịch thanh toán')
    expect(w.find('[data-test="contract-terms-save"]').exists()).toBe(false)
  })
})
