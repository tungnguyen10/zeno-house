import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { InvoiceStatus } from '~/utils/constants/billing'
import PortalInvoiceStatusBadge from '~/components/portal/PortalInvoiceStatusBadge.vue'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'

describe('PortalInvoiceStatusBadge', () => {
  it.each([
    ['paid', 'paid'],
    ['overdue', 'overdue'],
    ['issued', 'due'],
    ['partial', 'due'],
    ['draft', 'due'],
    ['void', 'due'],
  ] as const)('maps %s to the %s statement accent', (status, accent) => {
    expect(portalInvoiceStatementAccent(status)).toBe(accent)
  })

  it.each<[InvoiceStatus, string]>([
    ['issued', 'Chưa thanh toán'],
    ['partial', 'Thanh toán một phần'],
    ['paid', 'Đã thanh toán'],
    ['overdue', 'Quá hạn'],
    ['void', 'Đã hủy'],
    ['draft', 'Nháp'],
  ])('renders the Vietnamese label for %s', (status, label) => {
    const wrapper = mount(PortalInvoiceStatusBadge, { props: { status } })
    expect(wrapper.text()).toBe(label)
  })

  it('applies a distinct tone for paid vs overdue', () => {
    const paid = mount(PortalInvoiceStatusBadge, { props: { status: 'paid' } })
    const overdue = mount(PortalInvoiceStatusBadge, { props: { status: 'overdue' } })
    expect(paid.classes()).toContain('text-portal-positive-ink')
    expect(overdue.classes()).toContain('text-portal-danger-ink')
  })
})
