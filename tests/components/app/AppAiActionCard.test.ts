import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AiActionPlanDto } from '~/types/ai'
import AppAiActionCard from '../../../app/components/app/AppAiActionCard.vue'

function plan(status: AiActionPlanDto['status'] = 'pending'): AiActionPlanDto {
  return {
    id: 'plan-1',
    conversationId: 'conversation-1',
    actionType: 'open_period',
    status,
    title: 'Mở kỳ tháng 7/2026',
    summary: 'Tòa nhà Zeno Central',
    buildingId: 'building-1',
    preview: { month: 7, year: 2026 },
    warnings: ['Kiểm tra chỉ số trước khi xác nhận.'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }
}

describe('AppAiActionCard', () => {
  it('renders preview and emits direct confirm/cancel actions while pending', async () => {
    const wrapper = mount(AppAiActionCard, { props: { plan: plan() } })
    expect(wrapper.text()).toContain('Mở kỳ tháng 7/2026')
    expect(wrapper.text()).toContain('Kiểm tra chỉ số trước khi xác nhận.')

    const buttons = wrapper.findAll('button')
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')
    expect(wrapper.emitted('cancel')).toEqual([['plan-1']])
    expect(wrapper.emitted('confirm')).toEqual([['plan-1']])
  })

  it('does not render mutation controls after completion', () => {
    const wrapper = mount(AppAiActionCard, { props: { plan: plan('succeeded') } })
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('succeeded')
  })

  it('renders an invoice ledger preview instead of raw financial JSON', () => {
    const invoicePlan = {
      ...plan(),
      actionType: 'reissue_invoice',
      preview: { old_total_amount: 1_000_000, new_total_amount: 1_100_000 },
    }
    const wrapper = mount(AppAiActionCard, { props: { plan: invoicePlan } })
    expect(wrapper.get('[data-testid="invoice-financial-preview"]').text()).toContain('1.000.000')
    expect(wrapper.get('[data-testid="invoice-financial-preview"]').text()).toContain('1.100.000')
    expect(wrapper.find('pre').exists()).toBe(false)
  })

  it('renders a payment batch summary, invoice list, and skipped warnings without raw JSON', () => {
    const paymentPlan = {
      ...plan(),
      actionType: 'record_invoice_payments',
      title: 'Ghi thu 2 phòng kỳ 07/2026',
      preview: {
        eligibleCount: 2, totalAmount: 1_750_000,
        paymentDate: '2026-07-05', paymentMethod: 'cash',
        eligible: [
          { roomNumber: '01', invoiceCode: 'INV-01', amountToCollect: 1_000_000 },
          { roomNumber: '03', invoiceCode: 'INV-03', amountToCollect: 750_000 },
        ],
        alreadyPaidCount: 1, noInvoiceCount: 1, invalidRoomCount: 0, blockedCount: 0,
      },
      warnings: ['Bỏ qua 1 phòng đã ghi thu.', 'Bỏ qua 1 phòng không có hoá đơn trong kỳ.'],
    }
    const wrapper = mount(AppAiActionCard, { props: { plan: paymentPlan } })
    const summary = wrapper.get('[data-testid="invoice-financial-preview"]')
    expect(summary.text()).toContain('2')
    expect(summary.text()).toContain('1.750.000')
    expect(summary.text()).toContain('05/07/2026')
    expect(summary.text()).toContain('Tiền mặt')
    expect(wrapper.get('[data-testid="invoice-payment-list"]').text()).toContain('Phòng 01')
    expect(wrapper.get('[data-testid="invoice-payment-list"]').text()).toContain('INV-03')
    expect(wrapper.text()).toContain('Bỏ qua 1 phòng đã ghi thu.')
    expect(wrapper.find('pre').exists()).toBe(false)
  })

  it('collapses payment details after confirmation succeeds', () => {
    const paymentPlan = {
      ...plan('succeeded'),
      actionType: 'record_invoice_payments',
      title: 'Ghi thu 2 phòng kỳ 07/2026',
      preview: {
        eligibleCount: 2,
        totalAmount: 1_750_000,
        paymentDate: '2026-07-05',
        paymentMethod: 'cash',
        eligible: [
          { roomNumber: '01', invoiceCode: 'INV-01', amountToCollect: 1_000_000 },
          { roomNumber: '03', invoiceCode: 'INV-03', amountToCollect: 750_000 },
        ],
      },
      warnings: ['Bỏ qua 1 phòng đã ghi thu.'],
    }

    const wrapper = mount(AppAiActionCard, { props: { plan: paymentPlan } })

    expect(wrapper.find('[data-testid="invoice-financial-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="invoice-payment-list"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Bỏ qua 1 phòng đã ghi thu.')
    expect(wrapper.get('[data-testid="invoice-payment-completed"]').text()).toBe('Đã ghi thu thành công.')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('disables both actions and labels the confirm button while busy', () => {
    const wrapper = mount(AppAiActionCard, { props: { plan: plan(), busy: true } })
    const buttons = wrapper.findAll('button')
    expect(buttons.every(button => button.attributes('disabled') !== undefined)).toBe(true)
    expect(wrapper.text()).toContain('Đang xử lý…')
  })

  it('renders an inline action error when provided', () => {
    const wrapper = mount(AppAiActionCard, { props: { plan: plan(), error: 'Kế hoạch đã hết hạn.' } })
    expect(wrapper.get('[data-testid="action-error"]').text()).toContain('Kế hoạch đã hết hạn.')
  })

  it('blocks confirming an expired pending plan', () => {
    const expiredPlan = { ...plan(), expiresAt: new Date(Date.now() - 60_000).toISOString() }
    const wrapper = mount(AppAiActionCard, { props: { plan: expiredPlan } })
    const confirmButton = wrapper.findAll('button')[1]
    expect(confirmButton?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Kế hoạch đã hết hạn, hãy yêu cầu trợ lý tạo preview mới.')
  })
})
