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
})
