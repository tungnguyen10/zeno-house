import type { ApiSuccess } from '~/types/api'
import type {
  InvoiceEmailDelivery,
  InvoiceEmailEnqueueResult,
} from '~/types/invoice-email'
import { getApiErrorMessage } from '~/utils/api-error'

export function useInvoiceEmailDelivery() {
  const sending = ref(false)
  const loadingHistory = ref(false)
  const error = ref<string | null>(null)
  const history = ref<InvoiceEmailDelivery[]>([])
  let historyToken = 0

  async function enqueue(invoiceIds: string[]): Promise<InvoiceEmailEnqueueResult> {
    if (sending.value) throw new Error('INVOICE_EMAIL_SEND_IN_FLIGHT')
    sending.value = true
    error.value = null
    try {
      const response = await apiFetch<ApiSuccess<InvoiceEmailEnqueueResult>>(
        '/api/billing/invoices/email-deliveries',
        {
          method: 'POST',
          body: { invoice_ids: invoiceIds },
        },
      )
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể xếp hàng gửi hoá đơn.')
      throw cause
    }
    finally {
      sending.value = false
    }
  }

  async function loadHistory(invoiceId: string): Promise<InvoiceEmailDelivery[]> {
    const token = ++historyToken
    loadingHistory.value = true
    error.value = null
    try {
      const response = await apiFetch<ApiSuccess<InvoiceEmailDelivery[]>>(
        `/api/billing/invoices/${encodeURIComponent(invoiceId)}/email-deliveries`,
      )
      if (token === historyToken) history.value = response.data
      return response.data
    }
    catch (cause) {
      if (token === historyToken) {
        error.value = getApiErrorMessage(cause, 'Không thể tải lịch sử gửi email.')
      }
      throw cause
    }
    finally {
      if (token === historyToken) loadingHistory.value = false
    }
  }

  function clear() {
    historyToken += 1
    history.value = []
    error.value = null
    loadingHistory.value = false
  }

  return { sending, loadingHistory, error, history, enqueue, loadHistory, clear }
}
