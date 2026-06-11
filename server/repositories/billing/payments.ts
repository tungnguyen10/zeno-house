import { serverSupabaseClient } from '#supabase/server'
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
      .order('paid_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapInvoicePayment)
  },

  async sumByInvoice(event: H3Event, invoiceId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('amount')
      .eq('invoice_id', invoiceId)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
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
}
