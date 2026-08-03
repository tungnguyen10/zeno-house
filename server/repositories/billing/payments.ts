import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Invoice, InvoicePayment } from '~/types/billing'
import { mapInvoice, mapInvoicePayment } from '~/utils/mappers/billing'
import type { InvoicePaymentCreateInput } from '~/utils/validators/billing'
import type { Tables } from '~/types/database.types'
import { throwAgentError } from '../../utils/ai'

export interface AiInvoicePaymentsRpcInput {
  periodId: string
  actorId: string
  payments: Array<{
    invoiceId: string
    roomId: string
    expectedUpdatedAt: string
    expectedBalanceAmount: number
  }>
  paymentDate: string
  paymentMethod: string
  note: string | null
  correlationId: string
}

export interface AiInvoicePaymentsRpcResult {
  count: number
  totalAmount: number
  invoiceIds: string[]
  payments: InvoicePayment[]
  invoices: Invoice[]
  replayed: boolean
}

function aiPaymentRpcMessage(error: unknown): string {
  return error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message.toUpperCase()
    : ''
}

export function throwAiPaymentRpcError(error: unknown): never {
  const message = aiPaymentRpcMessage(error)
  const paymentFailure = message.includes('AI_PAYMENT_ALREADY_PAID')
    ? 'already_paid'
    : message.includes('AI_PAYMENT_PERIOD_CLOSED')
      ? 'period_closed'
      : message.includes('AI_PAYMENT_PERIOD_NOT_FOUND')
        ? 'invalid_period'
        : message.includes('AI_PAYMENT_INVOICE_NOT_FOUND')
          || message.includes('AI_PAYMENT_INVOICE_PERIOD_MISMATCH')
          || message.includes('AI_PAYMENT_INVOICE_ROOM_CONFLICT')
          ? 'invalid_invoice'
          : message.includes('AI_PAYMENT_INVOICE_VERSION_CONFLICT')
            || message.includes('AI_PAYMENT_BALANCE_CONFLICT')
            ? 'stale_version'
            : message.includes('AI_PAYMENT_INVOICE_NOT_COLLECTIBLE')
              ? 'not_collectible'
              : null
  if (paymentFailure) {
    const publicMessage = paymentFailure === 'already_paid'
      ? 'Hoá đơn đã được ghi thu trước đó.'
      : paymentFailure === 'period_closed'
        ? 'Kỳ đã chốt, không thể ghi thu.'
        : 'Dữ liệu hoá đơn đã thay đổi. Vui lòng tạo lại kế hoạch ghi thu.'
    throwAgentError(409, 'CONFLICT', publicMessage, {
      category: 'OPTIMISTIC_LOCK_CONFLICT', retryable: true,
      details: { paymentFailure },
    })
  }
  if (
    message.includes('AI_PAYMENT_INVALID_PAYLOAD')
    || message.includes('AI_PAYMENT_METHOD_REQUIRED')
    || message.includes('AI_PAYMENT_DUPLICATE_INVOICE')
    || message.includes('AI_PAYMENT_CORRELATION_REQUIRED')
  ) {
    throwValidationError('Dữ liệu ghi thu AI không hợp lệ')
  }
  throwDbError(error, 'billing.payments.recordAiBatchWithAudit')
}

export const InvoicePaymentRepository = {
  async recordAiBatchWithAudit(
    event: H3Event,
    input: AiInvoicePaymentsRpcInput,
  ): Promise<AiInvoicePaymentsRpcResult> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('record_ai_invoice_payments_with_audit' as never, {
      p_period_id: input.periodId,
      p_actor_id: input.actorId,
      p_payments: input.payments.map(payment => ({
        invoice_id: payment.invoiceId,
        room_id: payment.roomId,
        expected_updated_at: payment.expectedUpdatedAt,
        expected_balance_amount: payment.expectedBalanceAmount,
      })),
      p_payment_date: input.paymentDate,
      p_payment_method: input.paymentMethod,
      p_note: input.note,
      p_correlation_id: input.correlationId,
    } as never)
    if (error) throwAiPaymentRpcError(error)
    const result = data as unknown as {
      count?: number
      total_amount?: number | string
      payments?: Tables<'invoice_payments'>[]
      invoices?: Tables<'invoices'>[]
      replayed?: boolean
    } | null
    if (!result || !Array.isArray(result.payments) || !Array.isArray(result.invoices)) {
      throwInternal(new Error('Invalid AI invoice payment result'), 'billing.payments.recordAiBatchWithAudit')
    }
    const payments = result.payments.map(mapInvoicePayment)
    const invoices = result.invoices.map(mapInvoice)
    return {
      count: Number(result.count ?? payments.length),
      totalAmount: Number(result.total_amount ?? 0),
      invoiceIds: invoices.map(invoice => invoice.id),
      payments,
      invoices,
      replayed: result.replayed === true,
    }
  },

  async listByInvoice(event: H3Event, invoiceId: string): Promise<InvoicePayment[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('paid_at', { ascending: false })
    if (error) throwDbError(error, 'billing.payments.listByInvoice')
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
    if (error) throwDbError(error, 'billing.payments.listByInvoiceIds')
    return (data ?? []).map(mapInvoicePayment)
  },

  async sumByInvoice(event: H3Event, invoiceId: string): Promise<number> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoice_payments')
      .select('amount')
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
    if (error) throwDbError(error, 'billing.payments.sumByInvoice')
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
    if (error) throwDbError(error, 'billing.payments.findById')
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
    if (error) throwDbError(error, 'billing.payments.insert')
    return mapInvoicePayment(data)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client.from('invoice_payments').delete().eq('id', id)
    if (error) throwDbError(error, 'billing.payments.deleteById')
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
    if (error) throwDbError(error, 'billing.payments.softDelete')
  },
}
