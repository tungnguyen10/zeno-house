import { readFileSync } from 'node:fs'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import UiAlert from '../../../app/components/ui/UiAlert.vue'
import ContractRenewalForm from '../../../app/components/contracts/ContractRenewalForm.vue'
import ContractPaymentsSection from '../../../app/components/contracts/ContractPaymentsSection.vue'
import ContractDetailHero from '../../../app/components/contracts/ContractDetailHero.vue'
import ContractCheckoutSection from '../../../app/components/contracts/ContractCheckoutSection.vue'
import { useContractRenewals } from '../../../app/composables/contracts/useContractRenewals'
import type { ContractWithDetails } from '../../../app/types/contracts'
import { addDays, formatDateOnlyVi } from '../../../app/utils/format/date-only'
import { formatCurrency } from '../../../app/utils/format/currency'

const panel = defineComponent({ setup(_, { slots }) { return () => h('div', [slots.default?.(), slots.actions?.()]) } })
const field = defineComponent({ props: ['modelValue', 'label', 'error', 'disabled'], emits: ['update:modelValue'], setup(p, { emit }) { return () => h('label', [p.label, h('input', { value: p.modelValue, disabled: p.disabled, onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value) }), p.error]) } })
const link = defineComponent({ props: ['to'], setup(p, { slots }) { return () => h('a', { href: p.to }, slots.default?.()) } })
const stubs = { UiSection: panel, UiSurfacePanel: panel, UiAlert, UiInput: field, UiDatePicker: field, UiTextarea: field, ContractPaymentForm: true, UiSelect: true, UiSkeleton: true, UiStatusBadge: true, UiConfirmModal: true, NuxtLink: link, IconChevronDown: true, IconSpinner: true }
const contract: ContractWithDetails = {
  id: 'c', status: 'renewed', contractCode: 'HD-1', roomId: 'room', tenantId: 'tenant', buildingId: 'building',
  startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 3000000, deposit: 3000000,
  paymentDueDay: 5, occupantCount: 1, discountAmount: 0, surchargeAmount: 0,
  previousContractId: null, originalEndDate: null, renewalCount: 1, notes: null, createdAt: '', updatedAt: '',
  room: { id: 'room', code: 'P-1', roomNumber: '101', floor: 1, buildingId: 'building', buildingName: 'Zeno' },
  tenant: { id: 'tenant', code: 'T-1', fullName: 'Khách thuê', phone: '' },
  previousContract: null, successorContract: { id: 'next', code: 'HD-2' },
}
const renderForm = (props = {}) => mount(ContractRenewalForm, { props: { currentEndDate: '2026-12-31', currentMonthlyRent: 3000000, ...props }, global: { stubs } })
async function newContract(wrapper: ReturnType<typeof renderForm>, date = '2027-02-01') {
  await wrapper.findAll('button').find(b => b.text() === 'Hợp đồng mới')!.trigger('click')
  await wrapper.find('input').setValue(date)
}

describe('contract renewal flow', () => {
  it('shows the next inclusive start and real transfer summary', async () => {
    const wrapper = renderForm({ occupantCount: 3, serviceCount: 2, depositHeld: 1250000 })
    await newContract(wrapper)
    expect(wrapper.text()).toContain('Hợp đồng mới bắt đầu: 1/1/2027')
    expect(wrapper.text()).toContain('3 người ở')
    expect(wrapper.text()).toContain('2 dịch vụ')
    expect(wrapper.text()).toContain(formatCurrency(1250000))
  })
  it.each(['2026-12-31', '2027-01-01'])('rejects an end date at or before successor start: %s', async date => {
    const wrapper = renderForm()
    await newContract(wrapper, date)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Phải sau ngày bắt đầu hợp đồng mới')
  })
  it('preserves explicit zero rent and omits blank rent on extend', async () => {
    const wrapper = renderForm()
    await wrapper.findAll('input')[0]!.setValue('2027-02-01')
    await wrapper.findAll('input')[1]!.setValue('0')
    await wrapper.find('form').trigger('submit')
    await wrapper.findAll('input')[1]!.setValue('')
    await wrapper.find('form').trigger('submit')
    const submissions = wrapper.emitted('submit')! as Array<[{ new_monthly_rent?: number }]>
    expect(submissions[0]![0].new_monthly_rent).toBe(0)
    expect(submissions[1]![0].new_monthly_rent).toBeUndefined()
  })
  it('rejects blank rent for a successor', async () => {
    const wrapper = renderForm()
    await newContract(wrapper)
    await wrapper.findAll('input')[1]!.setValue('')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Giá thuê không hợp lệ')
  })
  it('uses calendar arithmetic across leap days and year boundaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(formatDateOnlyVi('2027-01-01')).toBe('1/1/2027')
  })
  it('keeps the same UUID across failed request retries', async () => {
    const wrapper = renderForm()
    await newContract(wrapper)
    await wrapper.find('form').trigger('submit')
    await wrapper.setProps({ apiError: 'Thử lại' })
    await wrapper.find('form').trigger('submit')
    const submissions = wrapper.emitted('submit')! as Array<[{ operation_id: string }]>
    expect(submissions[0]![0].operation_id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
    expect(submissions[1]![0].operation_id).toBe(submissions[0]![0].operation_id)
  })
  it('locks modes, fields and submit while loading, including programmatic submit', async () => {
    const wrapper = renderForm()
    await newContract(wrapper)
    await wrapper.setProps({ loading: true })
    expect(wrapper.findAll('button').every(b => b.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.findAll('input').every(i => i.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
  it('renders server errors in the existing alert', () => {
    const wrapper = renderForm({ apiError: 'Hợp đồng đã được thay đổi' })
    expect(wrapper.findComponent({ name: 'UiAlert' }).text()).toContain('Hợp đồng đã được thay đổi')
  })
  it('shows read-only payment history and deposit transfer for renewed contracts', () => {
    const wrapper = mount(ContractPaymentsSection, { props: { contract, payments: [{ id: 'p', contractId: 'c', paymentType: 'deposit', amount: 100, paidAt: '2026-01-01', coveredPeriodStart: null, coveredPeriodEnd: null, paymentMethod: null, note: null, createdAt: '', updatedAt: '' }], isLoading: false, canManage: true, addPayment: vi.fn(), updatePayment: vi.fn(), removePayment: vi.fn() }, global: { stubs } })
    expect(wrapper.text()).toContain('Hợp đồng đã gia hạn. Tiền cọc đang giữ đã chuyển sang HĐ HD-2.')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain(formatCurrency(100))
  })
  it('surfaces backend payment mutation errors through the shared helper', async () => {
    const failure = { data: { error: { message: 'Hợp đồng đã gia hạn, không thể thay đổi thanh toán' } } }
    const wrapper = mount(ContractPaymentsSection, { props: { payments: [], isLoading: false, canManage: true, addPayment: vi.fn().mockRejectedValue(failure), updatePayment: vi.fn(), removePayment: vi.fn() }, global: { stubs } })
    await wrapper.findAll('button').find(b => b.text() === '+ Thêm thanh toán')!.trigger('click')
    wrapper.findComponent({ name: 'ContractPaymentForm' }).vm.$emit('submit', { payment_type: 'deposit', amount: 100 })
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ContractPaymentForm' }).attributes('api-error')).toBe('Hợp đồng đã gia hạn, không thể thay đổi thanh toán')
  })
  it('links predecessor and successor using readable contract routes', () => {
    const wrapper = mount(ContractDetailHero, { props: { contract: { ...contract, previousContract: { id: 'prior', code: 'HD-0' } } }, global: { stubs } })
    expect(wrapper.findAll('a').find(a => a.text() === 'Đã gia hạn sang HĐ HD-2')?.attributes('href')).toBe('/dashboard/contracts/HD-2')
    expect(wrapper.findAll('a').find(a => a.text() === 'Gia hạn từ HĐ HD-0')?.attributes('href')).toBe('/dashboard/contracts/HD-0')
  })
  it('shows inherited source provenance and hides impossible return entry on renewed contracts', () => {
    const wrapper = mount(ContractCheckoutSection, { props: { bundle: { enabled: true, checkout: null, depositHeld: 100, creditHeld: 0, statement: null, refunds: [], sources: [{ id: 'p', originContractId: 'prior', originContractCode: 'HD-0', paymentType: 'deposit', amount: 100, approvedAmount: 0 }] }, contractId: 'c', contractCode: 'HD-1', contractStatus: 'renewed', loading: false, error: null, canManage: true, canSettle: false, canIssue: false, canRefund: false, actions: {} } as never, global: { stubs } })
    expect(wrapper.text()).toContain('Từ HĐ HD-0')
    expect(wrapper.text()).toContain('Hợp đồng đã gia hạn')
    expect(wrapper.find('form').exists()).toBe(false)
  })
  it('does not duplicate history when the backend replays a renewal', async () => {
    const renewal = { id: 'r' }
    vi.stubGlobal('apiFetch', vi.fn(async () => ({ data: renewal })))
    const state = useContractRenewals('c')
    const input = { mode: 'extend' as const, new_end_date: '2027-02-01' }
    await state.renew(input)
    await state.renew(input)
    await flushPromises()
    expect(state.renewals.value).toEqual([renewal])
  })
})


describe('renewal summary page wiring', () => {
  // Exercise the real page bindings without booting unrelated route data and shell behavior.
  const page = readFileSync('app/pages/dashboard/contracts/[code]/index.vue', 'utf8')
  const renewalTemplate = page.match(/<ContractRenewalForm\b[\s\S]*?\/>/)![0]
  function renderSummary(overrides = {}) {
    const context = {
      contract: { endDate: '2026-12-31', monthlyRent: 3000000 },
      occupantsLoading: false, occupantsError: null, activeOccupantCount: 0,
      servicesLoading: false, servicesError: null, contractServices: [],
      checkoutLoading: false, checkoutError: null, checkoutBundle: { enabled: false },
      paymentsLoading: false, paymentsError: null, depositHeld: 0,
      isRenewing: false, renewalApiError: null, handleRenew: vi.fn(), showRenewalForm: true,
      ...overrides,
    }
    return mount(defineComponent({ components: { ContractRenewalForm }, setup: () => context, template: renewalTemplate }), { global: { stubs } })
  }
  it('renders unknown people and services after failed requests', async () => {
    const wrapper = renderSummary({ occupantsError: new Error('Failed'), servicesError: new Error('Failed') })
    const form = wrapper.findComponent(ContractRenewalForm)
    expect(form.props('occupantCount')).toBeUndefined()
    expect(form.props('serviceCount')).toBeUndefined()
    await newContract(form)
    expect(form.text()).toContain('— người ở · — dịch vụ')
  })
  it('renders unknown receipt balance when checkout is disabled and payment loading failed', async () => {
    const wrapper = renderSummary({ paymentsError: new Error('Failed') })
    const form = wrapper.findComponent(ContractRenewalForm)
    expect(form.props('depositHeld')).toBeUndefined()
    await newContract(form)
    expect(form.text()).toContain('Tiền cọc đang giữ: —')
  })
  it.each([{ paymentsError: new Error('Failed') }, { paymentsLoading: true }])('uses a successful enabled checkout balance independently of unavailable receipts: %o', paymentState => {
    const form = renderSummary({ checkoutBundle: { enabled: true }, ...paymentState, depositHeld: 1250000 }).findComponent(ContractRenewalForm)
    expect(form.props('depositHeld')).toBe(1250000)
  })
  it('keeps successful empty data as known zeros', () => {
    const form = renderSummary().findComponent(ContractRenewalForm)
    expect(form.props('occupantCount')).toBe(0)
    expect(form.props('serviceCount')).toBe(0)
    expect(form.props('depositHeld')).toBe(0)
  })
})
