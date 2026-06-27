import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DashboardCollectionDonut from '../../app/components/dashboard/DashboardCollectionDonut.vue'

vi.mock('vue-chartjs', () => ({
  Doughnut: defineComponent({
    props: ['data', 'options', 'plugins'],
    setup(props) {
      const datum = (i: number) => props.data?.datasets?.[0]?.data?.[i]
      return () => h('div', {
        'data-test': 'doughnut',
        'data-paid': datum(0),
        'data-in-grace': datum(1),
        'data-overdue': datum(2),
      })
    },
  }),
}))

type DonutProps = {
  collectionRate: number
  paidAmount: number
  invoiceTotal: number
  outstandingAmount: number
  overdueAmount?: number
  period?: string
}

function mountDonut(props: DonutProps) {
  return mount(DashboardCollectionDonut, {
    props,
    global: {
      stubs: {
        ClientOnly: defineComponent({
          setup(_, { slots }) { return () => slots.default?.() },
        }),
      },
    },
  })
}

describe('DashboardCollectionDonut', () => {
  it('renders empty state placeholder dataset when invoiceTotal is 0', () => {
    const wrapper = mountDonut({ collectionRate: 0, paidAmount: 0, invoiceTotal: 0, outstandingAmount: 0 })
    expect(wrapper.text()).toContain('Tỷ lệ thu tháng này')
    const chart = wrapper.find('[data-test="doughnut"]')
    expect(chart.attributes('data-paid')).toBe('1')
    expect(chart.attributes('data-in-grace')).toBeUndefined()
  })

  it('splits outstanding into in-grace and overdue segments', () => {
    const wrapper = mountDonut({
      collectionRate: 0.5,
      paidAmount: 5_000_000,
      invoiceTotal: 10_000_000,
      outstandingAmount: 5_000_000,
      overdueAmount: 2_000_000,
      period: '2026-06',
    })
    const chart = wrapper.find('[data-test="doughnut"]')
    expect(chart.attributes('data-paid')).toBe('5000000')
    expect(chart.attributes('data-in-grace')).toBe('3000000')
    expect(chart.attributes('data-overdue')).toBe('2000000')
    expect(wrapper.text()).toContain('Đã thu')
    expect(wrapper.text()).toContain('Chưa đến hạn')
    expect(wrapper.text()).toContain('Quá hạn')
    expect(wrapper.text()).toContain('Tổng phát hành')
    expect(wrapper.text()).toContain('Tháng 6/2026')
  })

  it('treats all outstanding as in-grace when overdueAmount is not provided', () => {
    const wrapper = mountDonut({
      collectionRate: 0.8,
      paidAmount: 8_000_000,
      invoiceTotal: 10_000_000,
      outstandingAmount: 2_000_000,
    })
    const chart = wrapper.find('[data-test="doughnut"]')
    expect(chart.attributes('data-in-grace')).toBe('2000000')
    expect(chart.attributes('data-overdue')).toBe('0')
  })
})
