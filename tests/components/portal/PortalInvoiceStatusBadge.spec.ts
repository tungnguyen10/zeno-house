import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { InvoiceStatus } from '~/utils/constants/billing'
import PortalInvoiceStatusBadge from '~/components/portal/PortalInvoiceStatusBadge.vue'

describe('PortalInvoiceStatusBadge', () => {
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
    expect(paid.classes()).toContain('text-success')
    expect(overdue.classes()).toContain('text-error')
  })
})
