import { serverSupabaseClient } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Invoice, InvoiceCharge } from '~/types/billing'
import type { InvoiceStatus } from '~/utils/constants/billing'
import { mapInvoice, mapInvoiceCharge } from '~/utils/mappers/billing'
import type { ChargeInput } from '~/utils/validators/billing'

export const InvoiceRepository = {
  async listByPeriod(event: H3Event, billingPeriodId: string): Promise<Invoice[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('billing_period_id', billingPeriodId)
      .order('created_at', { ascending: true })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoice)
  },

  async findById(event: H3Event, id: string): Promise<Invoice | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
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

    const { data: invoiceRow, error: invErr } = await client
      .from('invoices')
      .insert({
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
    if (invErr) throw createError({ statusCode: 500, message: invErr.message })

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
        throw createError({ statusCode: 500, message: chErr.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoiceCharge)
  },

  async listCharges(event: H3Event, invoiceId: string): Promise<InvoiceCharge[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_charges')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true })
    if (error) throw createError({ statusCode: 500, message: error.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
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
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoice)
  },
}
