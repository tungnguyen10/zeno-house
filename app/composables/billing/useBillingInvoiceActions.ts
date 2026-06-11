import type { ApiSuccess } from '~/types/api'
import type {
  Invoice,
  InvoicePayment,
  InvoiceWithCharges,
} from '~/types/billing'
import type {
  AdjustmentChargeInput,
  InvoicePaymentCreateInput,
  ReissueInvoiceInput,
  VoidInvoiceInput,
} from '~/utils/validators/billing'

/**
 * Invoice-scoped operations for the billing workspace: load detail, void,
 * reissue, add adjustment, record payment.
 */
export function useBillingInvoiceActions() {
  async function load(invoiceId: string): Promise<InvoiceWithCharges> {
    const resp = await $fetch<ApiSuccess<InvoiceWithCharges>>(`/api/billing/invoices/${invoiceId}`)
    return resp.data
  }

  async function voidInvoice(invoiceId: string, input: VoidInvoiceInput): Promise<Invoice> {
    const resp = await $fetch<ApiSuccess<Invoice>>(`/api/billing/invoices/${invoiceId}/void`, {
      method: 'POST',
      body: input,
    })
    return resp.data
  }

  async function reissue(voidedInvoiceId: string, input: ReissueInvoiceInput): Promise<Invoice> {
    const resp = await $fetch<ApiSuccess<Invoice>>(`/api/billing/invoices/${voidedInvoiceId}/reissue`, {
      method: 'POST',
      body: input,
    })
    return resp.data
  }

  async function addAdjustment(targetInvoiceId: string, input: Omit<AdjustmentChargeInput, 'target_invoice_id'>) {
    const resp = await $fetch<ApiSuccess<{ invoice: Invoice; charge: unknown }>>(`/api/billing/invoices/${targetInvoiceId}/adjustment`, {
      method: 'POST',
      body: input,
    })
    return resp.data
  }

  async function recordPayment(invoiceId: string, input: InvoicePaymentCreateInput): Promise<{ payment: InvoicePayment; invoice: Invoice }> {
    const resp = await $fetch<ApiSuccess<{ payment: InvoicePayment; invoice: Invoice }>>(`/api/billing/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: input,
    })
    return resp.data
  }

  async function listPayments(invoiceId: string): Promise<InvoicePayment[]> {
    const resp = await $fetch<ApiSuccess<InvoicePayment[]>>(`/api/billing/invoices/${invoiceId}/payments`)
    return resp.data
  }

  return {
    load,
    voidInvoice,
    reissue,
    addAdjustment,
    recordPayment,
    listPayments,
  }
}
