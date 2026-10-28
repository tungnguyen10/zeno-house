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
      const dataAttr = JSON.stringify(props.data?.datasets?.[0]?.data ?? [])
      return () => h('div', { 'data-test': 'bar', 'data-labels': labelsAttr, 'data-first': dataAttr })
    },
  }),
}))

const emptyStub = defineComponent({
  props: ['title', 'description'],
  template: '<div data-test="empty">{{ title }}</div>',
})

function mountChart(trend: BillingTrendEntry[], currentPeriod?: string) {
  return mount(DashboardBillingTrendChart, {
    props: { trend, currentPeriod },
    global: {
      stubs: {
        ClientOnly: defineComponent({ setup(_, { slots }) { return () => slots.default?.() } }),
        UiEmptyState: emptyStub,
      },
    },
  })
}

function entry(period: string, categories: Partial<BillingTrendEntry['categories']>): BillingTrendEntry {
  const filled = { rent: 0, electricity: 0, water: 0, service: 0, other: 0, ...categories }
  const invoiceTotal = Object.values(filled).reduce((sum, n) => sum + n, 0)
  return {
    period,
    invoiceTotal,
    paidAmount: invoiceTotal,
    outstandingAmount: 0,
    overdueAmount: 0,
    categories: filled,
    byBuilding: {},
  }
}

describe('DashboardBillingTrendChart', () => {
  it('renders empty state when trend has no revenue', () => {
    const wrapper = mountChart([])
    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="bar"]').exists()).toBe(false)
  })

  it('renders only categories that have data, in canonical order', () => {
    const wrapper = mountChart([
      entry('2026-04', { rent: 1_000_000, electricity: 400_000, water: 100_000 }),
      entry('2026-05', { rent: 1_200_000, electricity: 500_000, water: 150_000 }),
    ])
    const chart = wrapper.find('[data-test="bar"]')
    expect(chart.exists()).toBe(true)
    const labels = JSON.parse(chart.attributes('data-labels') || '[]')
    expect(labels).toEqual(['Tiền phòng', 'Điện', 'Nước'])
  })

  it('leaves months after the current period empty instead of zero', () => {
    const wrapper = mountChart([
      entry('2026-09', { rent: 1_000_000 }),
      entry('2026-10', { rent: 1_200_000 }),
      entry('2026-11', {}),
    ], '2026-10')
    const data = JSON.parse(wrapper.get('[data-test="bar"]').attributes('data-first') || '[]')
    expect(data).toEqual([1_000_000, 1_200_000, null])
  })
})
