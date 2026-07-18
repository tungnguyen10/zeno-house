import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { InvoiceStatus } from '~/utils/constants/billing'
import PortalStatusBadge from '~/components/portal/PortalStatusBadge.vue'
import { portalInvoiceStatementAccent } from '~/utils/constants/portal-status'

describe('PortalStatusBadge', () => {
  it.each([
    ['paid', 'paid'],
    ['overdue', 'overdue'],
    ['issued', 'due'],
    ['partial', 'due'],
    ['draft', 'due'],
    ['void', 'due'],
  ] as const)('maps invoice %s to the %s statement accent', (status, accent) => {
    expect(portalInvoiceStatementAccent(status)).toBe(accent)
  })

  it.each<[InvoiceStatus, string]>([
    ['issued', 'Chưa thanh toán'],
    ['partial', 'Thanh toán một phần'],
    ['paid', 'Đã thanh toán'],
    ['overdue', 'Quá hạn'],
    ['void', 'Đã hủy'],
    ['draft', 'Nháp'],
  ])('renders the Vietnamese invoice label for %s', (status, label) => {
    const wrapper = mount(PortalStatusBadge, { props: { status } })
    expect(wrapper.text()).toBe(label)
  })

  it.each([
    ['new', 'Mới gửi'],
    ['in_progress', 'Đang xử lý'],
    ['resolved', 'Đã xử lý'],
  ] as const)('renders the Vietnamese request label for %s', (status, label) => {
    const wrapper = mount(PortalStatusBadge, { props: { status } })
    expect(wrapper.text()).toBe(label)
  })

  it('applies a distinct tone for paid vs overdue invoices', () => {
    const paid = mount(PortalStatusBadge, { props: { status: 'paid' } })
    const overdue = mount(PortalStatusBadge, { props: { status: 'overdue' } })
    expect(paid.classes()).toContain('text-portal-positive-ink')
    expect(overdue.classes()).toContain('text-portal-danger-ink')
  })

  it('shares positive semantics between a resolved request and a paid invoice', () => {
    const request = mount(PortalStatusBadge, { props: { status: 'resolved' } })
    const invoice = mount(PortalStatusBadge, { props: { status: 'paid' } })
    expect(request.classes()).toContain('text-portal-positive-ink')
    expect(invoice.classes()).toContain('text-portal-positive-ink')
  })

  it('uses the shared accent semantics while a request is in progress', () => {
    const wrapper = mount(PortalStatusBadge, { props: { status: 'in_progress' } })
    expect(wrapper.classes()).toContain('text-theme')
  })

  it('is the status badge used by the request list', () => {
    const page = readFileSync(resolve('app/pages/portal/requests.vue'), 'utf8')
    expect(page).toContain('<PortalStatusBadge :status="request.status" />')
    expect(page).not.toContain('STATUS_CLASS')
    expect(page).not.toContain('STATUS_LABELS')
  })
})
