import { UndoPaymentService } from '../../../../../services/billing/undo-payment'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const invoiceId = getRouterParam(event, 'id')
  const paymentId = getRouterParam(event, 'paymentId')
  if (!invoiceId) throwValidationError('Thiếu mã hoá đơn')
  if (!paymentId) throwValidationError('Thiếu mã khoản thu')

  const body = await readBody(event).catch(() => null)
  const reason = typeof body?.reason === 'string' ? body.reason : null

  const invoice = await UndoPaymentService.undoPayment(event, user, invoiceId!, paymentId!, reason)
  return { data: invoice }
})
