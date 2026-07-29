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
  Line: defineComponent({
    props: ['data', 'options'],
    setup(props) {
      return () => h('div', {
        'data-test': 'line',
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
  it('renders billed and paid series with a text alternative', () => {
    const wrapper = mountChart([
      invoice(3, 4_000_000, 3_000_000),
      invoice(2, 3_500_000, 3_500_000),
    ])
    const datasets = JSON.parse(
      wrapper.get('[data-test="line"]').attributes('data-datasets') ?? '[]',
    )

    expect(datasets.map((dataset: { label?: string }) => dataset.label))
      .toEqual(['Tổng hóa đơn', 'Đã thanh toán'])
    expect(datasets[0].fill).toBe(true)
    expect(datasets[1].borderDash).toEqual([5, 4])
    expect(wrapper.text()).toContain('Tổng hóa đơn')
    expect(wrapper.text()).toContain('Đã thanh toán')
    expect(wrapper.get('[data-test="chart-summary"]').text())
      .toContain('02/26 đến 03/26')
  })

  it('keeps the empty state when invoice data is unavailable', () => {
    const wrapper = mountChart([])

    expect(wrapper.text()).toContain('Chưa có dữ liệu')
    expect(wrapper.find('[data-test="line"]').exists()).toBe(false)
  })

  it('uses the active portal positive token for the paid legend', () => {
    expect(source).toContain('border-[color:var(--portal-positive)]')
    expect(source).not.toContain('border-portal-positive')
  })
})
