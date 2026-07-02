import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { InvoicePayment } from '~/types/billing'
import { mapInvoicePayment } from '~/utils/mappers/billing'
import type { InvoicePaymentCreateInput } from '~/utils/validators/billing'

export const InvoicePaymentRepository = {
  async listByInvoice(event: H3Event, invoiceId: string): Promise<InvoicePayment[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('paid_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoicePayment)
  },

  async listByInvoiceIds(event: H3Event, invoiceIds: string[]): Promise<InvoicePayment[]> {
    if (invoiceIds.length === 0) return []
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('*')
      .in('invoice_id', invoiceIds)
      .is('deleted_at', null)
      .order('paid_at', { ascending: true })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoicePayment)
  },

  async sumByInvoice(event: H3Event, invoiceId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('amount')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
  },

  async findById(event: H3Event, id: string): Promise<InvoicePayment | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapInvoicePayment(data) : null
  },

  async insert(
    event: H3Event,
    invoiceId: string,
    recordedBy: string | null,
    input: InvoicePaymentCreateInput,
  ): Promise<InvoicePayment> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        amount: input.amount,
        paid_at: input.paid_at,
        payment_method: input.payment_method ?? null,
        note: input.note ?? null,
        recorded_by: recordedBy,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapInvoicePayment(data)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('invoice_payments').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async softDelete(
    event: H3Event,
    id: string,
    deletedBy: string | null,
    reason: string | null,
  ): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('invoice_payments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        delete_reason: reason,
      })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
