import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PortalDebtSummary from '~/components/portal/PortalDebtSummary.vue'
import PortalButton from '~/components/portal/PortalButton.vue'
import type { TenantFinancialSummary, TenantInvoiceListItem } from '~/types/tenant-portal'

const invoice = { id: 'older-unpaid', invoiceCode: 'INV-10', periodYear: 2026, periodMonth: 10, status: 'partial', balanceAmount: 200_000, dueDate: null, overdueDate: null } as TenantInvoiceListItem
const summary: TenantFinancialSummary = { outstandingAmount: 700_000, outstandingCount: 2, overdueAmount: 500_000, overdueCount: 1, nextInvoice: invoice }
function render(value = summary) {
  return mount(PortalDebtSummary, { props: { summary: value }, global: { components: { PortalButton }, stubs: { PortalCard: { template: '<div><slot /></div>' }, PortalStatusBadge: true, IconCheckSmall: true, IconSpinner: true } } })
}

describe('portal total debt action', () => {
  it('renders authoritative all-period totals separately from the next invoice amount', () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('700.000')
    expect(wrapper.text()).toContain('2 hoá đơn')
    expect(wrapper.text()).toContain('200.000')
    expect(wrapper.text()).toContain('Chưa có hạn thanh toán')
    expect(wrapper.text()).not.toContain('Đã hoàn tất')
  })

  it('opens the prioritized outstanding invoice rather than the latest history item', async () => {
    const wrapper = render()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('openInvoice')).toEqual([['older-unpaid']])
  })

  it('has no payment action when the authoritative total is settled', () => {
    const wrapper = render({ outstandingAmount: 0, outstandingCount: 0, overdueAmount: 0, overdueCount: 0, nextInvoice: null })
    expect(wrapper.text()).toContain('Không có khoản cần thanh toán')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
