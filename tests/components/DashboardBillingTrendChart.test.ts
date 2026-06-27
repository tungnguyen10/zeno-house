import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DashboardBillingTrendChart from '../../app/components/dashboard/DashboardBillingTrendChart.vue'
import type { BillingTrendEntry } from '../../app/types/dashboard'

vi.mock('vue-chartjs', () => ({
  Bar: defineComponent({
    props: ['data', 'options'],
    setup(props) {
      const labelsAttr = JSON.stringify(props.data?.datasets?.map((d: { label?: string }) => d.label) ?? [])
      return () => h('div', { 'data-test': 'bar', 'data-labels': labelsAttr })
    },
  }),
}))

const emptyStub = defineComponent({
  props: ['title', 'description'],
  template: '<div data-test="empty">{{ title }}</div>',
})

function mountChart(trend: BillingTrendEntry[]) {
  return mount(DashboardBillingTrendChart, {
    props: { trend },
    global: {
      stubs: {
        ClientOnly: defineComponent({ setup(_, { slots }) { return () => slots.default?.() } }),
        UiEmptyState: emptyStub,
      },
    },
  })
}

describe('DashboardBillingTrendChart', () => {
  it('renders empty state when trend is empty', () => {
    const wrapper = mountChart([])
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="bar"]').exists()).toBe(false)
  })

  it('renders three stacked datasets when trend has data', () => {
    const wrapper = mountChart([
      { period: '2026-04', paidAmount: 1_000_000, outstandingAmount: 500_000, overdueAmount: 200_000, invoiceCount: 4 },
      { period: '2026-05', paidAmount: 1_500_000, outstandingAmount: 700_000, overdueAmount: 100_000, invoiceCount: 5 },
    ])
    const bar = wrapper.find('[data-test="bar"]')
    expect(bar.exists()).toBe(true)
    const labels = JSON.parse(bar.attributes('data-labels') || '[]')
    expect(labels).toEqual(['Đã thu', 'Chưa thu trong hạn', 'Quá hạn'])
    const text = wrapper.text()
    expect(text).toContain('Đã thu')
    expect(text).toContain('Quá hạn')
  })
})
