import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InvoiceListTable from '../../../app/components/invoices/InvoiceListTable.vue'
import InvoicePreviewDrawer from '../../../app/components/invoices/InvoicePreviewDrawer.vue'
import type { InvoiceListItem } from '../../../app/utils/validators/invoices'

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'invoice-1',
    invoice_code: 'INV-2606-014',
    billing_period_id: 'period-1',
    period_year: 2026,
    period_month: 6,
    building_id: 'building-1',
    building_name: 'Toa A',
    building_slug: 'toa-a',
    room_id: 'room-1',
    room_number: '101',
    contract_id: 'contract-1',
    contract_code: 'HD-001',
    tenant_id: 'tenant-1',
    tenant_name: 'Nguyen Tung',
    tenant_phone: '0912345678',
    total_amount: 3_000_000,
    paid_amount: 1_000_000,
    balance_amount: 2_000_000,
    due_date: '2026-06-10',
    status: 'issued',
    issued_at: '2026-06-01T00:00:00.000Z',
    voided_at: null,
    void_reason: null,
    notes: null,
    ...overrides,
  }
}

const passthrough = defineComponent({
  props: ['title'],
  setup(props, { slots }) {
    return () => h('section', {}, [
      props.title ? h('h3', {}, String(props.title)) : null,
      slots.default?.(),
      slots.footer?.(),
    ])
  },
})

const stubs = {
  IconChevronRight: defineComponent({ template: '<span />' }),
  IconDocumentText: defineComponent({ template: '<span />' }),
  UiAlert: passthrough,
  UiButton: defineComponent({
    props: ['variant', 'disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  }),
  UiCheckbox: defineComponent({
    props: ['modelValue', 'ariaLabel'],
    emits: ['update:modelValue'],
    template: '<button type="button" role="checkbox" :aria-label="ariaLabel" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)">select</button>',
  }),
  UiDrawer: defineComponent({
    props: ['modelValue', 'title', 'width'],
    emits: ['update:modelValue'],
    setup(props, { slots }) {
      return () => props.modelValue
        ? h('aside', { 'data-test': 'drawer', 'data-width': props.width }, [
            h('header', {}, slots.header?.()),
            h('main', {}, slots.default?.()),
            h('footer', {}, slots.footer?.()),
          ])
        : null
    },
  }),
  UiEmptyState: defineComponent({
    props: ['title', 'description'],
    template: '<div data-test="empty">{{ title }} {{ description }}</div>',
  }),
  UiMetric: defineComponent({
    props: ['label', 'value'],
    template: '<div data-test="metric"><span>{{ label }}</span><strong>{{ value }}</strong></div>',
  }),
  UiSection: passthrough,
  UiSkeleton: defineComponent({ template: '<div data-test="skeleton" />' }),
  UiStatusBadge: defineComponent({
    props: ['status'],
    template: '<span data-test="status" :data-status="status">{{ status }}</span>',
  }),
  UiTable: defineComponent({
    props: ['rows', 'columns', 'loading', 'emptyTitle'],
    emits: ['rowClick'],
    setup(props, { slots, emit }) {
      return () => h('div', {
        'data-test': 'table',
        class: 'ui-table-stub',
      }, (props.rows as InvoiceListItem[]).map(row =>
        h('button', { type: 'button', onClick: () => emit('rowClick', row) }, [
          ...(props.columns as Array<{ key: string }>).map(col =>
            h('span', {}, slots[`cell-${col.key}`]?.({ row }) ?? String(row[col.key as keyof InvoiceListItem] ?? '')),
          ),
        ]),
      ))
    },
  }),
  BillingChargeBreakdown: defineComponent({
    props: ['lines', 'totalAmount'],
    template: '<div data-test="charges">{{ totalAmount }}</div>',
  }),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useToast', () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }))
  vi.stubGlobal('navigateTo', vi.fn(async () => {}))
  vi.stubGlobal('useInvoiceDetail', () => ({
    detail: ref({
      invoice: { totalAmount: 3_000_000, notes: null },
      charges: [{ chargeType: 'rent', label: 'Rent', quantity: 1, unitPrice: 3_000_000, amount: 3_000_000, sortOrder: 1 }],
      payments: [{
        id: 'payment-1',
        invoiceId: 'invoice-1',
        amount: 1_000_000,
        paidAt: '2026-06-05',
        paymentMethod: 'cash',
        note: 'Đợt 1',
        recordedBy: 'user-1',
        recordedByName: 'Admin',
        createdAt: '2026-06-05T00:00:00.000Z',
        updatedAt: '2026-06-05T00:00:00.000Z',
      }],
      invoiceProfile: {
        bankName: 'VIB',
        accountHolder: 'NGUYỄN TUẤN ANH',
        accountNumber: '375675817',
        transferContent: 'INV-2606-014-101',
        qrImageUrl: 'https://signed.example/qr.webp',
        logoImageUrl: null,
        snapshottedAt: '2026-06-01T00:00:00.000Z',
      },
    }),
    isLoading: ref(false),
    error: ref(null),
    load: vi.fn(async () => {}),
    clear: vi.fn(),
  }))
})

describe('InvoiceListTable responsive layout', () => {
  it('renders a mobile card surface and keeps the desktop table hidden until md', () => {
    const wrapper = mount(InvoiceListTable, {
      props: { rows: [invoice()] },
      global: { stubs },
    })

    const mobile = wrapper.find('.md\\:hidden')
    const desktopTable = wrapper.findComponent(stubs.UiTable)

    expect(mobile.exists()).toBe(true)
    expect(desktopTable.classes()).toContain('hidden')
    expect(desktopTable.classes()).toContain('md:block')
    expect(mobile.text()).toContain('Nguyen Tung')
    expect(mobile.text()).toContain('Toa A')
    expect(mobile.text()).toContain('INV-2606-014')
    expect(mobile.text()).toContain('Đã thu')
    expect(mobile.text()).toContain('Hạn')
  })

  it('emits open from the mobile invoice card', async () => {
    const row = invoice()
    const wrapper = mount(InvoiceListTable, {
      props: { rows: [row] },
      global: { stubs },
    })

    await wrapper.get('button[aria-label="Mở hoá đơn INV-2606-014"]').trigger('click')
    expect(wrapper.emitted('open')).toEqual([[row]])
  })

  it('exposes print selection for active rows only without nested mobile buttons', async () => {
    const active = invoice({ id: 'invoice-active', invoice_code: 'INV-A' })
    const voided = invoice({ id: 'invoice-void', invoice_code: 'INV-V', status: 'void' })
    const wrapper = mount(InvoiceListTable, {
      props: { rows: [active, voided], selectedIds: new Set<string>() },
      global: { stubs },
    })

    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(2)
    expect(wrapper.findAll('.md\\:hidden button button')).toHaveLength(0)
    await wrapper.get('[aria-label="Chọn hoá đơn INV-A"]').trigger('click')
    expect(wrapper.emitted('toggle-select')).toEqual([[active]])
    expect(wrapper.find('[aria-label="Chọn hoá đơn INV-V"]').exists()).toBe(false)
  })
})

describe('InvoicePreviewDrawer responsive layout', () => {
  it('uses the app drawer with full mobile width and compact invoice-only content spacing', () => {
    const wrapper = mount(InvoicePreviewDrawer, {
      props: { modelValue: true, invoice: invoice() },
      global: { stubs },
    })

    expect(wrapper.get('[data-test="drawer"]').attributes('data-width')).toBe('w-full sm:w-[480px]')
    expect(wrapper.find('.-mx-2.-my-1.space-y-3').exists()).toBe(true)
    expect(wrapper.find('footer .-mx-2.-my-1.grid').exists()).toBe(true)
  })

  it('renders payments as mobile cards and keeps the table desktop-only', () => {
    const wrapper = mount(InvoicePreviewDrawer, {
      props: { modelValue: true, invoice: invoice() },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('cash')
    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.text()).toContain('Đợt 1')

    const paymentTable = wrapper.findComponent(stubs.UiTable)
    expect(paymentTable.classes()).toContain('hidden')
    expect(paymentTable.classes()).toContain('md:block')
  })

  it('keeps the invoice preview read-only', () => {
    const wrapper = mount(InvoicePreviewDrawer, {
      props: { modelValue: true, invoice: invoice() },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Mở trong kỳ')
    expect(wrapper.text()).toContain('Sao mã')
    expect(wrapper.text()).not.toContain('Ghi thanh toán')
    expect(wrapper.text()).not.toContain('Huỷ hoá đơn')
    expect(wrapper.text()).not.toContain('Điều chỉnh')
    expect(wrapper.text()).toContain('Thông tin chuyển khoản khi phát hành')
    expect(wrapper.text()).toContain('INV-2606-014-101')
  })

  it('emits print intent for one active invoice', async () => {
    const row = invoice()
    const wrapper = mount(InvoicePreviewDrawer, {
      props: { modelValue: true, invoice: row },
      global: { stubs },
    })

    const printButton = wrapper.findAll('footer button').find(button => button.text() === 'In phiếu')
    expect(printButton).toBeTruthy()
    await printButton!.trigger('click')
    expect(wrapper.emitted('print')).toEqual([[row.id]])
  })
})
