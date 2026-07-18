import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import PortalInvoiceStatusBadge from '~/components/portal/PortalInvoiceStatusBadge.vue'
import PortalRequestStatusBadge from '~/components/portal/PortalRequestStatusBadge.vue'

describe('PortalRequestStatusBadge', () => {
  it.each([
    ['new', 'Mới gửi'],
    ['in_progress', 'Đang xử lý'],
    ['resolved', 'Đã xử lý'],
  ] as const)('renders the shared Vietnamese label for %s', (status, label) => {
    const wrapper = mount(PortalRequestStatusBadge, { props: { status } })
    expect(wrapper.text()).toBe(label)
  })

  it('shares positive semantics with a paid invoice', () => {
    const request = mount(PortalRequestStatusBadge, { props: { status: 'resolved' } })
    const invoice = mount(PortalInvoiceStatusBadge, { props: { status: 'paid' } })
    expect(request.classes()).toContain('text-portal-positive-ink')
    expect(invoice.classes()).toContain('text-portal-positive-ink')
  })

  it('uses the shared accent semantics while a request is in progress', () => {
    const wrapper = mount(PortalRequestStatusBadge, { props: { status: 'in_progress' } })
    expect(wrapper.classes()).toContain('text-theme')
  })

  it('is the status badge used by the request list', () => {
    const page = readFileSync(resolve('app/pages/portal/requests.vue'), 'utf8')
    expect(page).toContain('<PortalRequestStatusBadge :status="request.status" />')
    expect(page).not.toContain('STATUS_CLASS')
    expect(page).not.toContain('STATUS_LABELS')
  })
})
