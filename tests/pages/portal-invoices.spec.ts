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
const navigateToMock = vi.fn()

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('usePortalChrome', () => ({ chrome: ref({ title: '', back: null }), setChrome: vi.fn() }))
vi.stubGlobal('usePortalInvoices', () => invoicesState)

const InvoicesPage = (await import('../../app/pages/portal/invoices/index.vue')).default

const stubs = {
  PortalPullToRefresh: { props: ['onRefresh'], template: '<div><slot /></div>' },
  PortalSkeleton: { props: ['variant'], template: '<div class="skeleton" :data-variant="variant" />' },
  PortalCard: { props: ['padded'], template: '<div class="card"><slot /></div>' },
  PortalEmptyState: {
    props: ['title', 'description', 'tone', 'actionLabel'],
    template: '<div class="empty" :data-tone="tone">{{ title }}</div>',
  },
  PortalStatusBadge: { props: ['status'], template: '<span class="badge">{{ status }}</span>' },
  IconChevronRight: { template: '<span class="chevron" />' },
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
    navigateToMock.mockClear()
  })

  it('shows skeletons while pending', () => {
    invoicesState.status.value = 'pending'
    const wrapper = mountPage()
    expect(wrapper.findAll('.skeleton').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-ledger-skeleton]')).toHaveLength(6)
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

  it('groups invoices by year while preserving their backend order', () => {
    invoicesState.invoices.value = [
      invoice({ id: 'jul-2026', periodMonth: 7 }),
      invoice({ id: 'jan-2026', periodMonth: 1 }),
      invoice({ id: 'dec-2025', periodYear: 2025, periodMonth: 12 }),
    ]
    const wrapper = mountPage()

    expect(wrapper.findAll('[data-invoice-year]').map(year => year.attributes('data-invoice-year'))).toEqual(['2026', '2025'])
    expect(wrapper.findAll('[data-invoice-row]').map(row => row.attributes('data-invoice-row'))).toEqual([
      'jul-2026',
      'jan-2026',
      'dec-2025',
    ])
    expect(wrapper.findAll('.card')).toHaveLength(2)
  })

  it('renders a polished statement row with formatted due date and payment context', () => {
    invoicesState.invoices.value = [
      invoice({ id: 'a', paidAmount: 250_000, balanceAmount: 750_000 }),
      invoice({ id: 'b', status: 'paid', paidAmount: 1_000_000, balanceAmount: 0 }),
    ]
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Lịch sử hoá đơn')
    expect(wrapper.text()).toContain('2 hoá đơn')
    expect(wrapper.text()).toContain('Hạn thanh toán 15/7/2026')
    expect(wrapper.findAll('.badge')).toHaveLength(2)
    expect(wrapper.findAll('.portal-money')).toHaveLength(2)
    expect(wrapper.findAll('.portal-money-unit').every(unit => unit.text() === '₫')).toBe(true)
    expect(wrapper.text()).toContain('Đã trả 250.000 ₫')
  })

  it('makes the whole ledger row the only interactive control', async () => {
    invoicesState.invoices.value = [invoice()]
    const wrapper = mountPage()
    const row = wrapper.get('[data-invoice-row="inv-1"]')

    expect(row.element.tagName).toBe('BUTTON')
    expect(row.findAll('button')).toHaveLength(0)
    await row.trigger('click')
    expect(navigateToMock).toHaveBeenCalledWith('/portal/invoices/inv-1')
  })

  it('keeps long statuses in normal flow on narrow screens', () => {
    invoicesState.invoices.value = [invoice({ status: 'partial' })]
    const wrapper = mountPage()
    const status = wrapper.get('[data-invoice-status]')

    expect(status.classes()).toContain('col-start-2')
    expect(status.classes()).not.toContain('absolute')
    expect(wrapper.get('[data-invoice-row]').classes()).toContain('active:bg-smoke')
  })
})
