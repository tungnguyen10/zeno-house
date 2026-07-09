import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Invoice, InvoiceCharge } from '~/types/billing'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { mapInvoice, mapInvoiceCharge } from '~/utils/mappers/billing'
import { isUuid } from '~/utils/format/slug'
import type { ChargeInput } from '~/utils/validators/billing'

function sequenceFromCode(prefix: string, code: string | null): number {
  if (!code?.startsWith(`${prefix}-`)) return 0
  const seq = Number(code.slice(prefix.length + 1))
  return Number.isInteger(seq) ? seq : 0
}

async function buildUniqueInvoiceCode(event: H3Event, billingPeriodId: string): Promise<string> {
  const client = await serverSupabaseClient(event)
  const { data: period, error: periodError } = await client
    .from('billing_periods')
    .select('period_year, period_month')
    .eq('id', billingPeriodId)
    .single()
  if (periodError) throwDbError(periodError, 'billing.invoices.buildUniqueInvoiceCode.period')

  const prefix = `inv-${period.period_year}-${String(period.period_month).padStart(2, '0')}`
  const { data, error } = await client
    .from('invoices')
    .select('invoice_code')
    .ilike('invoice_code', `${prefix}-%`)
  if (error) throwDbError(error, 'billing.invoices.buildUniqueInvoiceCode')

  const used = new Set((data ?? []).map(row => row.invoice_code).filter(Boolean))
  let next = Math.max(0, ...(data ?? []).map(row => sequenceFromCode(prefix, row.invoice_code))) + 1

  while (used.has(`${prefix}-${String(next).padStart(4, '0')}`)) next++
  return `${prefix}-${String(next).padStart(4, '0')}`
}

export const InvoiceRepository = {
  async listByPeriod(event: H3Event, billingPeriodId: string): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listByPeriod')
    return (data ?? []).map(mapInvoice)
  },

  async findById(event: H3Event, id: string): Promise<Invoice | null> {
    return this.findByIdentifier(event, id)
  },

  async findByIdentifier(event: H3Event, identifier: string): Promise<Invoice | null> {
    const client = await serverSupabaseClient(event)
    const column = isUuid(identifier) ? 'id' : 'invoice_code'
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq(column, identifier)
      .maybeSingle()
    if (error) throwDbError(error, 'billing.invoices.findByIdentifier')
    return data ? mapInvoice(data) : null
  },

  async findActiveByPeriodContract(
    event: H3Event,
    billingPeriodId: string,
    contractId: string,
  ): Promise<Invoice | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .eq('contract_id', contractId)
      .neq('status', 'void')
      .maybeSingle()
    if (error) throwDbError(error, 'billing.invoices.findActiveByPeriodContract')
    return data ? mapInvoice(data) : null
  },

  async issueOne(
    event: H3Event,
    input: {
      billing_period_id: string
      contract_id: string
      room_id: string
      tenant_id: string
      due_date: string | null
      issued_at: string
      subtotal: number
      discount: number
      surcharge: number
      total: number
      notes?: string | null
      supersedes_invoice_id?: string | null
    },
    charges: ChargeInput[],
  ): Promise<{ invoice: Invoice; charges: InvoiceCharge[] }> {
    const client = await serverSupabaseClient(event)
    const invoiceCode = await buildUniqueInvoiceCode(event, input.billing_period_id)

    const { data: invoiceRow, error: invErr } = await client
      .from('invoices')
      .insert({
        invoice_code: invoiceCode,
        billing_period_id: input.billing_period_id,
        contract_id: input.contract_id,
        room_id: input.room_id,
        tenant_id: input.tenant_id,
        status: 'issued',
        due_date: input.due_date,
        issued_at: input.issued_at,
        subtotal_amount: input.subtotal,
        discount_amount: input.discount,
        surcharge_amount: input.surcharge,
        total_amount: input.total,
        balance_amount: input.total,
        notes: input.notes ?? null,
        supersedes_invoice_id: input.supersedes_invoice_id ?? null,
      })
      .select()
      .single()
    if (invErr) throwDbError(invErr, 'billing.invoices.issueOne')

    let chargeRows: InvoiceCharge[] = []
    if (charges.length > 0) {
      const { data: chRows, error: chErr } = await client
        .from('invoice_charges')
        .insert(
          charges.map((c, idx) => ({
            invoice_id: invoiceRow.id,
            charge_type: c.charge_type,
            label: c.label,
            source_type: c.source_type ?? null,
            source_id: c.source_id ?? null,
            quantity: c.quantity,
            unit_price: c.unit_price,
            amount: c.amount,
            metadata: (c.metadata ?? {}) as never,
            sort_order: c.sort_order ?? idx,
          })),
        )
        .select()
      if (chErr) {
        // Best-effort rollback: delete the invoice we just created
        await client.from('invoices').delete().eq('id', invoiceRow.id)
        throwDbError(chErr, 'billing.invoices.issueOne.charges')
      }
      chargeRows = (chRows ?? []).map(mapInvoiceCharge)
    }

    return { invoice: mapInvoice(invoiceRow), charges: chargeRows }
  },

  async addCharges(
    event: H3Event,
    invoiceId: string,
    charges: ChargeInput[],
  ): Promise<InvoiceCharge[]> {
    if (charges.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .insert(
        charges.map((c, idx) => ({
          invoice_id: invoiceId,
          charge_type: c.charge_type,
          label: c.label,
          source_type: c.source_type ?? null,
          source_id: c.source_id ?? null,
          quantity: c.quantity,
          unit_price: c.unit_price,
          amount: c.amount,
          metadata: (c.metadata ?? {}) as never,
          sort_order: c.sort_order ?? idx,
        })),
      )
      .select()
    if (error) throwDbError(error, 'billing.invoices.addCharges')
    return (data ?? []).map(mapInvoiceCharge)
  },

  async listCharges(event: H3Event, invoiceId: string): Promise<InvoiceCharge[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true })
    if (error) throwDbError(error, 'billing.invoices.listCharges')
    return (data ?? []).map(mapInvoiceCharge)
  },

  async voidById(
    event: H3Event,
    id: string,
    voidedBy: string | null,
    reason: string,
  ): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .update({
        status: 'void',
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        void_reason: reason,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.invoices.voidById')
    return mapInvoice(data)
  },

  async linkSupersededBy(
    event: H3Event,
    voidedInvoiceId: string,
    replacementInvoiceId: string,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('invoices')
      .update({ superseded_by_invoice_id: replacementInvoiceId })
      .eq('id', voidedInvoiceId)
    if (error) throwDbError(error, 'billing.invoices.linkSupersededBy')
  },

  async updatePaymentTotals(
    event: H3Event,
    id: string,
    paid: number,
    balance: number,
    status: InvoiceStatus,
    paidAt: string | null,
  ): Promise<Invoice> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .update({
        paid_amount: paid,
        balance_amount: balance,
        status,
        paid_at: paidAt,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'billing.invoices.updatePaymentTotals')
    return mapInvoice(data)
  },

  async listOutstandingByPeriod(event: H3Event, billingPeriodId: string): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .gt('balance_amount', 0)
      .neq('status', 'void')
    if (error) throwDbError(error, 'billing.invoices.listOutstandingByPeriod')
    return (data ?? []).map(mapInvoice)
  },
}
