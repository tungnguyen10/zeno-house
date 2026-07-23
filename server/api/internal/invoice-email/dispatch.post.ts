import { InvoiceEmailDispatcher } from '../../../services/invoice-email/dispatcher'

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig(event).invoiceEmailDispatchSecret
  if (!secret || getHeader(event, 'x-invoice-email-dispatch-secret') !== secret) {
    throwForbidden('Không có quyền chạy bộ gửi hoá đơn')
  }
  return { data: await InvoiceEmailDispatcher.run(event) }
})
