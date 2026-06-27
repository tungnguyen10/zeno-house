import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import DashboardCollectionDonut from '../../app/components/dashboard/DashboardCollectionDonut.vue'

vi.mock('vue-chartjs', () => ({
  Doughnut: defineComponent({
    props: ['data', 'options', 'plugins'],
    setup(props) {
      return () => h('div', { 'data-test': 'doughnut', 'data-paid': props.data?.datasets?.[0]?.data?.[0], 'data-remaining': props.data?.datasets?.[0]?.data?.[1] })
    },
  }),
}))

function mountDonut(props: { collectionRate: number; paidAmount: number; invoiceTotal: number; outstandingAmount: number }) {
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
  it('shows empty caption when invoiceTotal is 0', () => {
    const wrapper = mountDonut({ collectionRate: 0, paidAmount: 0, invoiceTotal: 0, outstandingAmount: 0 })
    expect(wrapper.text()).toContain('Tỷ lệ thu tháng này')
    // empty state passes placeholder dataset [0, 1]
    const chart = wrapper.find('[data-test="doughnut"]')
    expect(chart.attributes('data-paid')).toBe('0')
    expect(chart.attributes('data-remaining')).toBe('1')
  })

  it('renders chart with paid + remaining when there is data', () => {
    const wrapper = mountDonut({ collectionRate: 0.5, paidAmount: 5_000_000, invoiceTotal: 10_000_000, outstandingAmount: 5_000_000 })
    const chart = wrapper.find('[data-test="doughnut"]')
    expect(chart.attributes('data-paid')).toBe('5000000')
    expect(chart.attributes('data-remaining')).toBe('5000000')
    expect(wrapper.text()).toContain('Còn lại')
    expect(wrapper.text()).toContain('Đã phát hành')
  })
})
