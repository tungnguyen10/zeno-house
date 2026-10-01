import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ContractCheckoutSection from '../../../app/components/contracts/ContractCheckoutSection.vue'
import type { CheckoutBundle, CheckoutPreview } from '../../../app/types/checkout'

const panel = defineComponent({ setup(_, { slots }) { return () => h('div', slots.default?.()) } })
const button = defineComponent({ props: ['disabled', 'loading'], setup(p, { slots }) { return () => h('button', { disabled: p.disabled || p.loading }, slots.default?.()) } })
const stubs = { UiSection: panel, UiSurfacePanel: panel, UiAlert: panel, UiSkeleton: panel, UiButton: button, UiInput: true, UiDatePicker: true, UiTextarea: true, UiSelect: true, UiCheckbox: true, UiConfirmModal: true, NuxtLink: panel }
const bundle: CheckoutBundle = { enabled: true, checkout: { id: 'x', contractId: 'c', buildingId: 'b', actualReturnDate: '2026-10-01', reason: 'Trả phòng', status: 'returned', electricity: null, water: null, updatedAt: 'now' }, depositHeld: 3000000, creditHeld: 0, statement: null, refunds: [], sources: [] }
const preview: CheckoutPreview = { snapshotHash: 'hash', depositHeld: 3000000, creditHeld: 0, existingDebt: 500000, finalChargesTotal: 100000, totalDue: 600000, refundDue: 2400000, additionalDue: 0, depositApplied: 600000, creditApplied: 0, charges: [], invoices: [], blockers: [] }
function render(overrides = {}) {
  return mount(ContractCheckoutSection, { props: { bundle, loading: false, error: null, contractCode: 'HD-1', canManage: true, canSettle: true, canRefund: true, actions: { loadCorrectionInvoice: vi.fn(), correct: vi.fn(), addCharge: vi.fn(), save: vi.fn(), confirmReturn: vi.fn(), preview: vi.fn(async () => preview), confirm: vi.fn(), refund: vi.fn(), approveCredit: vi.fn() }, ...overrides }, global: { stubs } })
}

describe('ContractCheckoutSection', () => {
  it('hides checkout when rollout is disabled', () => {
    expect(render({ bundle: { ...bundle, enabled: false } }).text()).toBe('')
  })
  it('requires preview and shows allocation and refund before confirmation', async () => {
    const wrapper = render()
    expect(wrapper.text()).not.toContain('Xác nhận quyết toán')
    await wrapper.findAll('button').find(b => b.text() === 'Xem quyết toán')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Cọc đang giữ')
    expect(wrapper.text()).toContain('Cọc bù trừ')
    expect(wrapper.text()).toContain('Cần hoàn')
    expect(wrapper.text()).toContain('Xác nhận quyết toán')
    expect(wrapper.text()).not.toContain('Ghi nhận hoàn tiền')
  })
  it('blocks confirmation when preview has blockers', async () => {
    const wrapper = render({ actions: { loadCorrectionInvoice: vi.fn(), correct: vi.fn(), addCharge: vi.fn(), save: vi.fn(), confirmReturn: vi.fn(), preview: vi.fn(async () => ({ ...preview, blockers: ['Thiếu chỉ số nước'] })), confirm: vi.fn(), refund: vi.fn(), approveCredit: vi.fn() } })
    await wrapper.findAll('button').find(b => b.text() === 'Xem quyết toán')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Thiếu chỉ số nước')
    expect(wrapper.findAll('button').find(b => b.text() === 'Xác nhận quyết toán')!.attributes('disabled')).toBeDefined()
  })
  it('keeps handover confirmation disabled until edited readings are saved', async () => {
    const wrapper = render({ bundle: { ...bundle, checkout: { ...bundle.checkout!, status: 'draft' } } })
    const confirmation = () => wrapper.findAll('button').find(b => b.text() === 'Xác nhận trả phòng')!
    expect(confirmation().attributes('disabled')).toBeUndefined()
    wrapper.findAllComponents({ name: 'UiInput' })[0]!.vm.$emit('update:modelValue', '150')
    await flushPromises()
    expect(confirmation().attributes('disabled')).toBeDefined()
  })
  it('shows refund entry only after settlement and never refunds automatically', async () => {
    const refund = vi.fn()
    const wrapper = render({ bundle: { ...bundle, statement: { id: 's', code: 'QT-1', confirmedAt: '2026-10-01T00:00:00Z', confirmedBy: 'u', preview, refundedAmount: 0, remainingRefund: 2400000, outstandingDebt: 0, financialStatus: 'awaiting_refund' } }, actions: { loadCorrectionInvoice: vi.fn(), correct: vi.fn(), addCharge: vi.fn(), save: vi.fn(), confirmReturn: vi.fn(), preview: vi.fn(), confirm: vi.fn(), refund, approveCredit: vi.fn() } })
    await flushPromises()
    expect(wrapper.text()).toContain('Ghi nhận hoàn tiền')
    expect(wrapper.text()).toContain('Hệ thống không thực hiện chuyển tiền')
    expect(refund).not.toHaveBeenCalled()
  })
  it('blocks further refunds while an adjustment has outstanding debt', () => {
    const wrapper = render({ bundle: { ...bundle, statement: { id: 's', code: 'QT-1', confirmedAt: '2026-10-01T00:00:00Z', confirmedBy: 'u', preview, refundedAmount: 0, remainingRefund: 2400000, outstandingDebt: 100000, financialStatus: 'awaiting_payment' } } })
    expect(wrapper.text()).not.toContain('Ghi nhận hoàn tiền')
    expect(wrapper.text()).toContain('Cần thu hết nợ điều chỉnh')
  })
  it('does not offer financial mutations to a handover-only user', () => {
    const wrapper = render({ canSettle: false, canRefund: false })
    expect(wrapper.text()).not.toContain('Xem quyết toán')
    expect(wrapper.text()).not.toContain('Duyệt tiền bù trừ')
  })
})
