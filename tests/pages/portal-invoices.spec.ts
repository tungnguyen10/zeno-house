import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { TenantInvoiceListItem } from '~/types/tenant-portal'

const invoicesState = {
  invoices: ref<TenantInvoiceListItem[]>([]),
  status: ref<'pending' | 'success' | 'error'>('success'),
  error: ref<unknown>(null),
  refresh: vi.fn(async () => {}),
}

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('usePortalChrome', () => ({ chrome: ref({ title: '', back: null }), setChrome: vi.fn() }))
vi.stubGlobal('usePortalInvoices', () => invoicesState)

const InvoicesPage = (await import('../../app/pages/portal/invoices/index.vue')).default

const stubs = {
  PortalPullToRefresh: { props: ['onRefresh'], template: '<div><slot /></div>' },
  PortalSkeleton: { props: ['variant'], template: '<div class="skeleton" :data-variant="variant" />' },
  PortalCard: { props: ['accent'], template: '<div class="card" :data-accent="accent"><slot /></div>' },
  PortalEmptyState: {
    props: ['title', 'description', 'tone', 'actionLabel'],
    template: '<div class="empty" :data-tone="tone">{{ title }}</div>',
  },
  PortalStatusBadge: { props: ['status'], template: '<span class="badge">{{ status }}</span>' },
}

function invoice(overrides: Partial<TenantInvoiceListItem> = {}): TenantInvoiceListItem {
  return {
    id: 'inv-1',
    invoiceCode: 'HD-001',
    billingPeriodId: 'p1',
    periodYear: 2026,
    periodMonth: 7,
    buildingId: 'b1',
    buildingName: 'Toa A',
    buildingSlug: 'toa-a',
    roomId: 'r1',
    roomNumber: '101',
    contractId: 'c1',
    contractCode: 'HĐ-1',
    totalAmount: 1_000_000,
    paidAmount: 0,
    balanceAmount: 1_000_000,
    dueDate: '2026-07-15',
    status: 'issued',
    issuedAt: null,
    voidedAt: null,
    voidReason: null,
    notes: null,
    ...overrides,
  }
}

function mountPage() {
  return mount(InvoicesPage, { global: { stubs } })
}

describe('portal invoices page — states', () => {
  beforeEach(() => {
    invoicesState.invoices.value = []
    invoicesState.status.value = 'success'
    invoicesState.error.value = null
  })

  it('shows skeletons while pending', () => {
    invoicesState.status.value = 'pending'
    const wrapper = mountPage()
    expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-variant="statement"]')).toHaveLength(6)
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  it('shows an error state on failure', () => {
    invoicesState.error.value = new Error('boom')
    const wrapper = mountPage()
    const empty = wrapper.find('.empty')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('data-tone')).toBe('error')
  })

  it('shows an empty state when there are no invoices', () => {
    const wrapper = mountPage()
    expect(wrapper.find('.empty').text()).toContain('Chưa có hoá đơn')
  })

  it('renders one card per invoice with its status badge', () => {
    invoicesState.invoices.value = [invoice({ id: 'a' }), invoice({ id: 'b', status: 'paid' })]
    const wrapper = mountPage()
    expect(wrapper.findAll('.card')).toHaveLength(2)
    expect(wrapper.findAll('.badge')).toHaveLength(2)
    expect(wrapper.findAll('.card').map(card => card.attributes('data-accent'))).toEqual(['due', 'paid'])
    expect(wrapper.findAll('.portal-money')).toHaveLength(2)
    expect(wrapper.findAll('.portal-money-unit').every(unit => unit.text() === '₫')).toBe(true)
  })
})
