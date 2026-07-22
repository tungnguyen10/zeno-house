import type { H3Event } from 'h3'
import type { TenantInvoiceListQuery } from '~/utils/validators/tenant-portal'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { CrossPeriodInvoiceRepository } from '../invoices'
import { db } from '../../utils/db'

export type TenantInvoiceScope =
  | { tenantId: string; contractId?: never }
  | { tenantId?: never; contractId: string }

interface TenantInvoiceChargeRow {
  id: string
  invoice_id: string
  charge_type: string
  label: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
}

export const TenantInvoiceRepository = {
  async list(
    event: H3Event,
    scope: TenantInvoiceScope,
    query: TenantInvoiceListQuery,
    today: string,
  ): Promise<{ items: InvoiceListItem[]; total: number }> {
    return CrossPeriodInvoiceRepository.listCrossPeriod(event, {
      ...query,
      status: [],
      today,
    }, scope)
  },

  async findDetail(
    event: H3Event,
    scope: TenantInvoiceScope,
    invoiceId: string,
  ): Promise<{ invoice: InvoiceListItem; charges: TenantInvoiceChargeRow[] } | null> {
    const invoice = await CrossPeriodInvoiceRepository.findCrossPeriodById(event, invoiceId, scope)
    if (!invoice) return null

    const { data, error } = await db(event)
      .from('invoice_charges')
      .select('id, invoice_id, charge_type, label, quantity, unit_price, amount, sort_order')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true })
    if (error) throwDbError(error, 'tenantPortal.invoices.findDetail.charges')
    return { invoice, charges: (data ?? []) as TenantInvoiceChargeRow[] }
  },
}
