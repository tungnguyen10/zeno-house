import type { H3Event } from 'h3'
import type { TenantInvoiceListQuery } from '~/utils/validators/tenant-portal'
import type { InvoiceListItem } from '~/utils/validators/invoices'
import { CrossPeriodInvoiceRepository } from '../invoices'
import { db } from '../../utils/db'
import type { Json } from '~/types/database.types'

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
  metadata: Json
}

interface TenantInvoicePaymentRow {
  id: string
  amount: number
  paid_at: string
  payment_method: string | null
  funding_source: string
}

async function listPayments(event: H3Event, invoiceId: string): Promise<TenantInvoicePaymentRow[]> {
  const rows: TenantInvoicePaymentRow[] = []
  const batchSize = 500
  for (let offset = 0; ; offset += batchSize) {
    const { data, error, count } = await db(event)
      .from('invoice_payments')
      .select('id, amount, paid_at, payment_method, funding_source', { count: 'exact' })
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('paid_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + batchSize - 1)
    if (error) throwDbError(error, 'tenantPortal.invoices.findDetail.payments')
    if (count === null) throwInternal(new Error('Missing invoice payment count'), 'tenantPortal.invoices.findDetail.payments')
    const expected = Math.min(batchSize, Math.max(0, count - offset))
    if ((data?.length ?? 0) !== expected) {
      throwInternal(new Error('Incomplete invoice payment history'), 'tenantPortal.invoices.findDetail.payments')
    }
    rows.push(...(data ?? []) as TenantInvoicePaymentRow[])
    if (offset + batchSize >= count) return rows
  }
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
    }, scope, { exactCount: true })
  },

  /** Read every unpaid issued row in scope, independently of the visible list page. */
  async listOutstanding(
    event: H3Event,
    scope: TenantInvoiceScope,
    today: string,
  ): Promise<InvoiceListItem[]> {
    const items = new Map<string, InvoiceListItem>()
    const pageSize = 500
    for (let page = 1; ; page += 1) {
      const result = await CrossPeriodInvoiceRepository.listCrossPeriod(event, {
        page,
        page_size: pageSize,
        status: ['issued', 'partial', 'overdue'],
        today,
      }, scope, { exactCount: true })
      // A lower upstream row cap must never turn an incomplete sum into "all debt".
      const expected = Math.min(pageSize, Math.max(0, result.total - (page - 1) * pageSize))
      if (result.items.length !== expected) {
        throwInternal(new Error('Incomplete tenant financial summary page'), 'tenantPortal.invoices.listOutstanding')
      }
      for (const invoice of result.items) items.set(invoice.id, invoice)
      if (page * pageSize >= result.total) return [...items.values()]
    }
  },

  async findDetail(
    event: H3Event,
    scope: TenantInvoiceScope,
    invoiceId: string,
  ): Promise<{ invoice: InvoiceListItem; charges: TenantInvoiceChargeRow[]; payments: TenantInvoicePaymentRow[] } | null> {
    const invoice = await CrossPeriodInvoiceRepository.findCrossPeriodById(event, invoiceId, scope)
    if (!invoice) return null

    // Scope succeeds before either query. Staff notes, actor IDs and audit details
    // are deliberately absent from the payment SELECT and the resulting DTO.
    const [charges, payments] = await Promise.all([
      db(event)
        .from('invoice_charges')
        .select('id, invoice_id, charge_type, label, quantity, unit_price, amount, sort_order, metadata', { count: 'exact' })
        .eq('invoice_id', invoice.id)
        .order('sort_order', { ascending: true }),
      listPayments(event, invoice.id),
    ])
    if (charges.error) throwDbError(charges.error, 'tenantPortal.invoices.findDetail.charges')
    if (charges.count === null || charges.count !== (charges.data?.length ?? 0)) {
      throwInternal(new Error('Incomplete invoice charge history'), 'tenantPortal.invoices.findDetail.charges')
    }
    return {
      invoice,
      charges: (charges.data ?? []) as TenantInvoiceChargeRow[],
      payments,
    }
  },
}
