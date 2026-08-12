import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DashboardRevenueOverview from '../../app/components/dashboard/DashboardRevenueOverview.vue'
import type { BillingTrendEntry, RevenueBreakdown } from '../../app/types/dashboard'

const breakdown: RevenueBreakdown = {
  totalIssued: 10_000_000,
  totalPaid: 8_000_000,
  categories: [
    { key: 'rent', amount: 7_000_000 },
    { key: 'electricity', amount: 2_000_000 },
    { key: 'water', amount: 1_000_000 },
  ],
}

const trend: BillingTrendEntry[] = [{
  period: '2026-01',
  invoiceTotal: 10_000_000,
  paidAmount: 8_000_000,
  outstandingAmount: 2_000_000,
  overdueAmount: 0,
  categories: { rent: 7_000_000, electricity: 2_000_000, water: 1_000_000, service: 0, other: 0 },
  byBuilding: {},
}]

function mountOverview(props = { breakdown, trend }) {
  return mount(DashboardRevenueOverview, {
    props,
    global: {
      stubs: {
        DashboardBillingTrendChart: defineComponent({
          props: ['trend'],
          template: '<div data-test="trend-chart">{{ trend.length }}</div>',
        }),
      },
    },
  })
}

describe('DashboardRevenueOverview', () => {
  it('combines revenue metrics, category rows and the trend chart', () => {
    const wrapper = mountOverview()

    expect(wrapper.get('[data-revenue-summary]').text()).toContain('80%')
    expect(wrapper.text()).toContain('Tiền phòng')
    expect(wrapper.text()).toContain('Điện')
    expect(wrapper.get('[data-test="trend-chart"]').text()).toBe('1')
  })

  it('uses the approved adaptive split only at desktop width', () => {
    const grid = mountOverview().get('[data-revenue-grid]')

    expect(grid.classes()).toContain('grid-cols-1')
    expect(grid.classes()).toContain('lg:grid-cols-[minmax(15rem,3fr)_minmax(0,7fr)]')
  })

  it('moves category share to a second line on narrow screens', () => {
    const share = mountOverview().get('[data-category-share="rent"]')

    expect(share.classes()).toContain('col-start-2')
    expect(share.classes()).toContain('sm:col-start-auto')
  })
})
