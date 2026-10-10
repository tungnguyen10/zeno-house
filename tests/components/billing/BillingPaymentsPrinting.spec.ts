import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import BillingPaymentsStep from '../../../app/components/billing/BillingPaymentsStep.vue'
import { buildInvoice } from '../../__fixtures__/billing/invoice'
import { buildPeriod } from '../../__fixtures__/billing/period'
import type { Invoice } from '../../../app/types/billing'

const openPrint = vi.fn()
const loadInvoice = vi.fn()

const passthrough = defineComponent({
  props: ['title'],
  template: '<section><h2 v-if="title">{{ title }}</h2><slot /><slot name="actions" /><slot name="footer" /></section>',
})

const tableStub = defineComponent({
  props: ['rows', 'columns'],
  setup(props, { slots }) {
    return () => h('div', { 'data-test': 'invoice-table' }, (props.rows as Invoice[]).map(row =>
      h('div', { 'data-test': `row-${row.id}` }, [
        slots['cell-select']?.({ row }),
        slots['cell-tenant']?.({ row }),
        slots['cell-actions']?.({ row }),
      ]),
    ))
  },
})

const checkboxStub = defineComponent({
  props: ['modelValue', 'ariaLabel'],
  emits: ['update:modelValue'],
  template: '<button type="button" role="checkbox" :aria-label="ariaLabel" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)">select</button>',
})

const drawerStub = defineComponent({
  props: ['modelValue'],
  setup(props, { slots }) {
    return () => props.modelValue ? h('aside', {}, [slots.default?.(), slots.footer?.()]) : null
  },
})

function mountPayments(invoices: Invoice[], status: 'issued' | 'closed' = 'issued') {
  return mount(BillingPaymentsStep, {
    props: {
      period: buildPeriod({ status }),
      invoices,
      loading: false,
      drafts: null,
    },
    global: {
      stubs: {
        UiSection: passthrough,
        UiToolbar: passthrough,
        UiTable: tableStub,
        UiCheckbox: checkboxStub,
        UiDrawer: drawerStub,
        UiButton: defineComponent({
          props: ['disabled', 'title'],
          emits: ['click'],
          template: '<button type="button" :disabled="disabled" :title="title" @click="$emit(\'click\', $event)"><slot /></button>',
        }),
        UiStatusBadge: passthrough,
        UiSelect: passthrough,
        UiModal: defineComponent({ template: '<div />' }),
        UiConfirmModal: defineComponent({ template: '<div />' }),
        UiDatePicker: passthrough,
        UiInput: passthrough,
        UiAlert: passthrough,
        UiSkeleton: passthrough,
        BillingChargeBreakdown: passthrough,
        BillingBulkPaymentModal: defineComponent({ template: '<div />' }),
        NuxtLink: passthrough,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useToast', () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
  vi.stubGlobal('useInvoicePrinting', () => ({ openPrint }))
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { invoiceEmailEnabled: false },
  }))
  vi.stubGlobal('useInvoiceEmailDelivery', () => ({
    sending: ref(false),
    loadingHistory: ref(false),
    error: ref(null),
    history: ref([]),
    enqueue: vi.fn(async () => ({ results: [], queuedCount: 0, failedCount: 0 })),
    loadHistory: vi.fn(async () => []),
    clear: vi.fn(),
  }))
  vi.stubGlobal('useBillingInvoiceActions', () => ({
    load: loadInvoice,
    recordPayment: vi.fn(),
    recordBulkPayments: vi.fn(),
    voidInvoice: vi.fn(),
    listPayments: vi.fn(async () => []),
  }))
})

describe('BillingPaymentsStep invoice printing', () => {
  it('opens the detail drawer immediately and offers retry when loading fails', async () => {
    const invoice = buildInvoice({ id: 'invoice-issued', invoiceCode: 'INV-1', status: 'issued' })
    let rejectLoad!: (reason: Error) => void
    loadInvoice.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectLoad = reject }))
    const wrapper = mountPayments([invoice])

    await wrapper.findAll('[data-test="row-invoice-issued"] button')[1]!.trigger('click')
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.find('aside [aria-busy="true"]').exists()).toBe(true)

    rejectLoad(new Error('Network unavailable'))
    await flushPromises()
    const retry = wrapper.findAll('aside button').find(button => button.text() === 'Thử lại')
    expect(retry).toBeTruthy()

    loadInvoice.mockResolvedValueOnce({ invoice, charges: [], payments: [] })
    await retry!.trigger('click')
    await flushPromises()
    expect(wrapper.find('aside [aria-busy="true"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Khoản phí')
  })

  it('keeps void invoices separate and orders them by room', () => {
    const wrapper = mountPayments([
      buildInvoice({ id: 'void-10', status: 'void', roomFloor: 1, roomNumber: '10', voidedAt: '2026-08-10T00:00:00Z' }),
      buildInvoice({ id: 'void-2', status: 'void', roomFloor: 1, roomNumber: '2', voidedAt: '2026-08-01T00:00:00Z' }),
    ])

    const voidTable = wrapper.findAll('[data-test="invoice-table"]')[1]!
    expect(voidTable.findAll('[data-test^="row-"]').map(row => row.attributes('data-test')))
      .toEqual(['row-void-2', 'row-void-10'])
  })

  it('keeps every active invoice selectable for print when the period is closed', () => {
    const wrapper = mountPayments([
      buildInvoice({ id: 'invoice-issued', status: 'issued' }),
      buildInvoice({ id: 'invoice-paid', status: 'paid', balanceAmount: 0, paidAmount: 3_500_000 }),
      buildInvoice({ id: 'invoice-void', status: 'void' }),
    ], 'closed')

    // 2 active invoices, each rendered once in the mobile card list and once in the desktop table.
    // Scoped to per-invoice checkboxes so the shared select-all row isn't counted.
    const invoiceCheckboxes = wrapper
      .findAll('[role="checkbox"]')
      .filter(el => el.attributes('aria-label')?.startsWith('Chọn hoá đơn'))
    expect(invoiceCheckboxes).toHaveLength(4)
  })

  it('prints a mixed selection while disabling bulk payment with guidance', async () => {
    const wrapper = mountPayments([
      buildInvoice({ id: 'invoice-issued', invoiceCode: 'INV-1', status: 'issued' }),
      buildInvoice({ id: 'invoice-paid', invoiceCode: 'INV-2', status: 'paid', balanceAmount: 0, paidAmount: 3_500_000 }),
    ])

    await wrapper.get('[aria-label="Chọn hoá đơn INV-1"]').trigger('click')
    await wrapper.get('[aria-label="Chọn hoá đơn INV-2"]').trigger('click')

    const printButton = wrapper.findAll('button').find(button => button.text() === 'In phiếu')
    const paymentButton = wrapper.findAll('button').find(button => button.text() === 'Ghi thu hàng loạt')
    expect(printButton).toBeTruthy()
    expect(paymentButton?.attributes('disabled')).toBeDefined()
    expect(paymentButton?.attributes('title')).toContain('chỉ gồm hóa đơn còn nợ')

    await printButton!.trigger('click')
    expect(openPrint).toHaveBeenCalledWith(['invoice-issued', 'invoice-paid'])
  })

  it('prints one active invoice from the detail drawer', async () => {
    const invoice = buildInvoice({ id: 'invoice-issued', invoiceCode: 'INV-1', status: 'issued' })
    loadInvoice.mockResolvedValue({ invoice, charges: [], payments: [] })
    const wrapper = mountPayments([invoice])

    await wrapper.findAll('[data-test="row-invoice-issued"] button')[1]!.trigger('click')
    await flushPromises()
    const printButton = wrapper.findAll('aside button').find(button => button.text() === 'In phiếu')
    expect(printButton).toBeTruthy()
    await printButton!.trigger('click')
    expect(openPrint).toHaveBeenCalledWith(['invoice-issued'])
  })
})
