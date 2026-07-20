import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
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
  vi.stubGlobal('useBillingInvoiceActions', () => ({
    load: loadInvoice,
    recordPayment: vi.fn(),
    recordBulkPayments: vi.fn(),
    voidInvoice: vi.fn(),
    listPayments: vi.fn(async () => []),
  }))
})

describe('BillingPaymentsStep invoice printing', () => {
  it('keeps every active invoice selectable for print when the period is closed', () => {
    const wrapper = mountPayments([
      buildInvoice({ id: 'invoice-issued', status: 'issued' }),
      buildInvoice({ id: 'invoice-paid', status: 'paid', balanceAmount: 0, paidAmount: 3_500_000 }),
      buildInvoice({ id: 'invoice-void', status: 'void' }),
    ], 'closed')

    expect(wrapper.findAll('[role="checkbox"]')).toHaveLength(2)
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
