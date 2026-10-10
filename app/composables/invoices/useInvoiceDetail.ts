import type { ApiSuccess } from '~/types/api'
import type { InvoiceWithCharges } from '~/types/billing'
import { getApiErrorMessage } from '~/utils/api-error'

export function useInvoiceDetail() {
  const detail = ref<InvoiceWithCharges | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  async function load(invoiceId: string): Promise<InvoiceWithCharges | null> {
    if (!invoiceId) return null
    const current = ++requestId
    isLoading.value = true
    detail.value = null
    error.value = null
    try {
      const resp = await apiFetch<ApiSuccess<InvoiceWithCharges>>(`/api/billing/invoices/${invoiceId}`)
      if (current === requestId) detail.value = resp.data
      return current === requestId ? resp.data : null
    }
    catch (err) {
      if (current === requestId) error.value = getApiErrorMessage(err, 'Không thể tải hoá đơn')
      return null
    }
    finally {
      if (current === requestId) isLoading.value = false
    }
  }

  function clear() {
    requestId++
    detail.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    detail,
    isLoading,
    error,
    load,
    clear,
  }
}
