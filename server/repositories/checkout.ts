import type { H3Event } from 'h3'
import type { CheckoutDraftInput } from '~/types/checkout'
import type { CheckoutChargeInput, CheckoutConfirmInput, CheckoutCorrectionInput, CheckoutCreditInput, CheckoutRefundInput, CheckoutReturnInput } from '~/utils/validators/checkout'
import { mapCheckoutBundle, mapCheckoutPreview } from '~/utils/mappers/checkout'
import { db } from '../utils/db'

const emptyBundle = () => ({ checkout: null, statement: null, depositHeld: 0, creditHeld: 0, refunds: [], sources: [] })

function checkoutError(error: { message?: string; code?: string }, context: string): never {
  const message = error.message ?? ''
  if (/CHECKOUT_|SETTLEMENT_|REFUND_|CREDIT_|BILLING_PERIOD_LOCKED|BILLING_INVOICE_LOCKED/.test(message)) {
    if (/NOT_FOUND/.test(message)) throwNotFound('Không tìm thấy hồ sơ trả phòng hoặc nguồn thanh toán')
    if (/INVALID|NEGATIVE|REQUIRED|MISSING|EXCEEDS|INSUFFICIENT/.test(message)) {
      throwValidationError('Dữ liệu tất toán chưa hợp lệ. Kiểm tra chỉ số, nguồn tiền và số dư.', { reason: message.match(/[A-Z][A-Z_]+/)?.[0] })
    }
    throwConflict('Dữ liệu tất toán đã thay đổi hoặc đang bị khoá. Tải lại và kiểm tra trước khi xác nhận.', { reason: message.match(/[A-Z][A-Z_]+/)?.[0] })
  }
  throwDbError(error, context)
}

async function call(event: H3Event, name: string, args: Record<string, unknown>, allowMissing = false): Promise<unknown> {
  const { data, error } = await db(event).rpc(name as never, args as never)
  // Read-only compatibility while the application is deployed before its opt-in migration.
  if (allowMissing && error?.code === 'PGRST202' && error.message.includes(name)) return emptyBundle()
  if (error) checkoutError(error, name)
  return data
}

async function bundle(event: H3Event, name: string, args: Record<string, unknown>, allowMissing = false) {
  const result = await call(event, name, args, allowMissing)
  try { return mapCheckoutBundle(result) }
  catch (error) { throwInternal(error, name) }
}

export const CheckoutRepository = {
  correct(event: H3Event, contractId: string, actorId: string, input: CheckoutCorrectionInput) {
    return bundle(event, 'contract_checkout_correct', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id,
      p_invoice_id: input.invoice_id, p_amount: input.amount, p_label: input.label,
      p_reason: input.reason, p_expected_updated_at: input.expected_updated_at,
    })
  },
  get(event: H3Event, contractId: string) {
    return bundle(event, 'contract_checkout_get', { p_contract_id: contractId }, true)
  },
  save(event: H3Event, contractId: string, actorId: string, input: CheckoutDraftInput) {
    return bundle(event, 'contract_checkout_save', { p_contract_id: contractId, p_actor_id: actorId, p_input: input })
  },
  returnRoom(event: H3Event, contractId: string, actorId: string, input: CheckoutReturnInput) {
    return bundle(event, 'contract_checkout_return', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id, p_expected_updated_at: input.expected_updated_at,
    })
  },
  async preview(event: H3Event, contractId: string) {
    const result = await call(event, 'contract_checkout_preview', { p_contract_id: contractId })
    try { return mapCheckoutPreview(result) }
    catch (error) { throwInternal(error, 'contract_checkout_preview') }
  },
  confirm(event: H3Event, contractId: string, actorId: string, input: CheckoutConfirmInput) {
    return bundle(event, 'contract_checkout_confirm', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id, p_snapshot_hash: input.snapshot_hash,
    })
  },
  refund(event: H3Event, contractId: string, actorId: string, input: CheckoutRefundInput) {
    return bundle(event, 'contract_checkout_refund', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id,
      p_amount: input.amount, p_paid_at: input.paid_at, p_payment_method: input.payment_method, p_note: input.note ?? null,
    })
  },
  credit(event: H3Event, contractId: string, actorId: string, input: CheckoutCreditInput) {
    return bundle(event, 'contract_checkout_credit', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id,
      p_payment_id: input.payment_id, p_amount: input.amount, p_reason: input.reason,
    })
  },
  charge(event: H3Event, contractId: string, actorId: string, input: CheckoutChargeInput) {
    return bundle(event, 'contract_checkout_charge', {
      p_contract_id: contractId, p_actor_id: actorId, p_operation_id: input.operation_id,
      p_label: input.label, p_amount: input.amount, p_note: input.note ?? null,
    })
  },
  undoCash(event: H3Event, contractId: string, actorId: string, invoiceId: string, paymentId: string, reason: string | null) {
    return bundle(event, 'contract_checkout_undo_cash', {
      p_contract_id: contractId, p_actor_id: actorId, p_invoice_id: invoiceId, p_payment_id: paymentId, p_reason: reason,
    })
  },
}
