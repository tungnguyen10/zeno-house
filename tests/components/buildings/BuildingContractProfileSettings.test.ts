import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import Component from '~/components/buildings/BuildingContractProfileSettings.vue'
import UiInput from '~/components/ui/UiInput.vue'
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'

const building = { id: 'b1', billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 } as Building
const profile = { buildingId: 'b1', lessorFullName: 'Nguyễn Văn A', lessorDateOfBirth: '1980-01-01', lessorPermanentAddress: 'Địa chỉ riêng', lessorIdNumber: '012345678901', lessorIdIssuedDate: '2021-05-01', lessorIdIssuedPlace: 'Huế', lessorPhone: '0901234567', lessorIdentityMasked: false, brandName: 'Zeno', defaultTermMonths: 12, defaultDepositMonths: 1, noticeDays: 30, depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0, signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null } satisfies BuildingContractProfile
const DatePicker = defineComponent({ props: ['modelValue', 'disabled'], emits: ['update:modelValue'], template: '<input :disabled="disabled" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' })
function mountForm(overrides = {}) {
  return mount(Component, { props: { profile: null, building, canEdit: true, saving: false, error: null, editPath: '/edit', ...overrides }, global: { stubs: { UiInput, UiDatePicker: DatePicker, UiAlert: { template: '<div role="alert"><slot /></div>' }, NuxtLink: { template: '<a><slot /></a>' } } } })
}
const save = (w: ReturnType<typeof mountForm>) => w.get('form').trigger('submit')

describe('contract settings', () => {
  it('saves an empty profile with explicit null values and copy defaults', async () => {
    const w = mountForm(); await save(w)
    expect(w.emitted('save')?.[0]?.[0]).toMatchObject({ lessor_full_name: null, default_term_months: null, signed_copies: 2, copies_per_party: 1 })
  })
  it('saves partial input and reports dirty state', async () => {
    const w = mountForm(); await w.get('[data-test="lessor-full-name"] input').setValue('Nguyễn Văn A'); await save(w)
    expect(w.emitted('save')?.[0]?.[0]).toMatchObject({ lessor_full_name: 'Nguyễn Văn A' })
    expect(w.emitted('dirty')?.at(-1)).toEqual([true])
  })
  it('saves a complete profile in snake case', async () => {
    const w = mountForm({ profile }); await save(w)
    expect(w.emitted('save')?.[0]?.[0]).toMatchObject({ lessor_id_number: '012345678901', default_term_months: 12, renewal_months: 0 })
  })
  it('validates identity and dependent copy counts without echoing identity', async () => {
    const w = mountForm(); await w.get('[data-test="lessor-id-number"] input').setValue('secret-invalid'); await w.get('[data-test="copies-per-party"] input').setValue('3'); await save(w)
    expect(w.emitted('save')).toBeUndefined(); expect(w.text()).toContain('9 hoặc 12 chữ số'); expect(w.text()).toContain('vượt quá'); expect(w.text()).not.toContain('secret-invalid')
  })
  it('blocks duplicate submissions and disables controls in flight', async () => {
    const w = mountForm({ saving: true }); await save(w); await save(w)
    expect(w.emitted('save')).toBeUndefined()
    expect(w.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    expect(w.get('[data-test="contract-profile-save"]').attributes('disabled')).toBeDefined()
  })
  it('shows server errors and refreshes form and dirty baseline from new props', async () => {
    const w = mountForm({ error: 'Không thể lưu' }); expect(w.text()).toContain('Không thể lưu')
    await w.get('[data-test="lessor-full-name"] input').setValue('Bản nháp'); await w.setProps({ profile })
    expect((w.get('[data-test="lessor-full-name"] input').element as HTMLInputElement).value).toBe('Nguyễn Văn A'); expect(w.emitted('dirty')?.at(-1)).toEqual([false])
  })
  it('preserves dirty edits when an unrelated settings refresh replaces an equivalent profile', async () => {
    const w = mountForm({ profile }); await w.get('[data-test="lessor-full-name"] input').setValue('Bản nháp')
    await w.setProps({ profile: { ...profile, updatedAt: 'new timestamp' } })
    expect((w.get('[data-test="lessor-full-name"] input').element as HTMLInputElement).value).toBe('Bản nháp')
    expect(w.emitted('dirty')?.at(-1)).toEqual([true])
  })
  it('clears dirty state on acknowledged save but retains it after a failed save', async () => {
    const w = mountForm(); await w.get('[data-test="lessor-full-name"] input').setValue('Bản nháp')
    await w.setProps({ saving: true }); await w.setProps({ saving: false, error: 'Không thể lưu' })
    expect(w.emitted('dirty')?.at(-1)).toEqual([true])
    await w.setProps({ saving: true, error: null }); await w.setProps({ saving: false })
    expect(w.emitted('dirty')?.at(-1)).toEqual([false])
    await w.get('[data-test="lessor-full-name"] input').setValue('Bản nháp mới')
    expect(w.emitted('dirty')?.at(-1)).toEqual([true])
  })
  it('renders manager definitions, masking all PII even if given raw values', async () => {
    const w = mountForm({ profile, canEdit: false }); expect(w.find('input').exists()).toBe(false); expect(w.find('[data-test="contract-profile-save"]').exists()).toBe(false)
    expect(w.text()).toContain('*******8901'); expect(w.text()).toContain('Ẩn với vai trò quản lý')
    for (const value of ['012345678901', '1980-01-01', 'Địa chỉ riêng']) expect(w.html()).not.toContain(value)
    expect(w.find('form').exists()).toBe(false)
  })
  it('previews the schedule and handles missing schedule and overflow day', async () => {
    const w = mountForm(); expect(w.text()).toContain('Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10')
    await w.setProps({ building: { ...building, paymentDueDay: 28 } }); expect(w.text()).toContain('quá 5 ngày sau hạn thanh toán'); expect(w.text()).not.toContain('ngày 33')
    await w.setProps({ building: { ...building, paymentDueDay: null } }); expect(w.text()).toContain('Chưa đủ lịch thanh toán'); expect(w.text()).toContain('Sửa lịch vận hành')
  })
})
