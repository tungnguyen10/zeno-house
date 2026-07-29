import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'
import PortalSpendingChart from '~/components/portal/PortalSpendingChart.vue'

const source = readFileSync(
  resolve('app/components/portal/PortalSpendingChart.vue'),
  'utf8',
)

vi.mock('vue-chartjs', () => ({
  Bar: defineComponent({
    props: ['data', 'options'],
    setup(props) {
      return () => h('div', {
        'data-test': 'bar',
        'data-datasets': JSON.stringify(props.data?.datasets ?? []),
        'data-animation-duration': String(props.options?.animation?.duration ?? ''),
      })
    },
  }),
}))

function invoice(
  month: number,
  totalAmount: number,
  paidAmount: number,
): TenantInvoiceListItem {
  return {
    id: `invoice-${month}`,
    invoiceCode: `HD-${month}`,
    billingPeriodId: `period-${month}`,
    periodYear: 2026,
    periodMonth: month,
    buildingId: 'building-1',
    buildingName: 'Zeno House',
    buildingSlug: 'zeno-house',
    roomId: 'room-1',
    roomNumber: 'A101',
    contractId: 'contract-1',
    contractCode: 'HD-A101',
    totalAmount,
    paidAmount,
    balanceAmount: Math.max(0, totalAmount - paidAmount),
    dueDate: null,
    status: paidAmount >= totalAmount ? 'paid' : 'partial',
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    notes: null,
  }
}

function mountChart(invoices: TenantInvoiceListItem[]) {
  return mount(PortalSpendingChart, {
    props: { invoices },
    global: {
      stubs: {
        ClientOnly: defineComponent({
          setup(_, { slots }) {
            return () => slots.default?.()
          },
        }),
      },
    },
  })
}

describe('PortalSpendingChart', () => {
  it('renders one monthly invoice-total bar series with a text alternative', () => {
    const wrapper = mountChart([
      invoice(3, 4_000_000, 3_000_000),
      invoice(2, 3_500_000, 3_500_000),
    ])
    const datasets = JSON.parse(
      wrapper.get('[data-test="bar"]').attributes('data-datasets') ?? '[]',
    )

    expect(datasets).toHaveLength(1)
    expect(datasets[0]).toMatchObject({
      label: 'Tổng hóa đơn theo tháng',
      data: [3_500_000, 4_000_000],
      borderRadius: 6,
      borderSkipped: 'bottom',
      maxBarThickness: 28,
    })
    expect(wrapper.text()).toContain('Tổng hóa đơn theo tháng')
    expect(wrapper.text()).not.toContain('Đã thanh toán')
    expect(wrapper.get('[data-test="chart-summary"]').text())
      .toContain('02/26 đến 03/26')
    expect(wrapper.get('[data-test="chart-summary"]').text())
      .toContain('tổng tiền hóa đơn của từng tháng')
  })

  it('keeps the empty state when invoice data is unavailable', () => {
    const wrapper = mountChart([])

    expect(wrapper.text()).toContain('Chưa có dữ liệu')
    expect(wrapper.find('[data-test="bar"]').exists()).toBe(false)
  })

  it('uses the active portal theme token for the monthly-total legend', () => {
    expect(source).toContain('bg-theme')
    expect(source).not.toContain('border-[color:var(--portal-positive)]')
  })
})
