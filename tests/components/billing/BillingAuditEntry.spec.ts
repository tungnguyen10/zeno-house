import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BillingAuditEntry from '../../../app/components/billing/BillingAuditEntry.vue'
import type { BillingAuditEvent } from '../../../app/types/billing'

// Stub NuxtLink for test env
const NuxtLinkStub = { name: 'NuxtLink', template: '<a v-bind="$attrs"><slot /></a>', props: ['to'] }

function makeEvent(overrides: Partial<BillingAuditEvent> = {}): BillingAuditEvent {
  return {
    id: 'evt-1',
    billingPeriodId: 'period-1',
    actorId: 'user-1',
    action: 'invoice.payment_recorded',
    entityType: 'invoice',
    entityId: 'inv-1',
    correlationId: null,
    beforeData: null,
    afterData: null,
    metadata: {},
    createdAt: new Date('2026-07-01T10:00:00Z').toISOString(),
    actorEmail: 'admin@example.com',
    actorName: 'Admin',
    entityLabel: 'HD-001',
    entitySubLabel: null,
    entityHref: '/billing/invoices/HD-001',
    summary: 'Ghi nhận thanh toán đủ',
    ...overrides,
  }
}

describe('BillingAuditEntry', () => {
  it('renders summary and actor', () => {
    const ev = makeEvent()
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.text()).toContain('Ghi nhận thanh toán đủ')
    expect(wrapper.text()).toContain('Admin')
  })

  it('renders reading.saved diff view (D6)', () => {
    const ev = makeEvent({
      action: 'reading.saved',
      metadata: { previous_value: 100, new_value: 150 },
      summary: 'Ghi chỉ số điện',
    })
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(wrapper.text()).toContain('100')
    expect(wrapper.text()).toContain('150')
    // delta = +50
    expect(wrapper.text()).toContain('+')
  })

  it('renders payment.undone diff view: before=amount → 0 (D6)', () => {
    const ev = makeEvent({
      action: 'payment.undone',
      metadata: { amount: 2_500_000, reason: 'Sai số' },
      summary: 'Hoàn tác thanh toán',
    })
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    // before amount shown
    expect(wrapper.text()).toContain('2.500.000')
    // after = 0
    expect(wrapper.text()).toContain('0')
  })

  it('emits filterCorrelation when "Xem cùng nhóm" button clicked (D7)', async () => {
    const correlationId = 'corr-abc-123'
    const ev = makeEvent({ correlationId })
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    const btn = wrapper.find('button[title*="corr-abc-123"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(wrapper.emitted('filterCorrelation')?.[0]).toEqual([correlationId])
  })

  it('shows → Mở link from entityHref (D8)', () => {
    const ev = makeEvent({ entityHref: '/billing/invoices/HD-001' })
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    const links = wrapper.findAllComponents(NuxtLinkStub)
    const hasOpenLink = links.some(l => l.text().includes('→ Mở'))
    expect(hasOpenLink).toBe(true)
  })

  it('shows "Chi tiết kỹ thuật" expand button when metadata present', async () => {
    const ev = makeEvent({ metadata: { foo: 'bar' } })
    const wrapper = mount(BillingAuditEntry, {
      props: { event: ev },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    const expandBtn = wrapper.findAll('button').find(b => b.text().includes('Chi tiết kỹ thuật'))
    expect(expandBtn).toBeDefined()
    await expandBtn!.trigger('click')
    expect(wrapper.find('pre').exists()).toBe(true)
    expect(wrapper.find('pre').text()).toContain('bar')
  })
})
