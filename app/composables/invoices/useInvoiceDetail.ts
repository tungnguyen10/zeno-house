import type { ApiSuccess } from '~/types/api'
import type { InvoiceWithCharges } from '~/types/billing'
import { getApiErrorMessage } from '~/utils/api-error'

export function useInvoiceDetail() {
  const detail = ref<InvoiceWithCharges | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load(invoiceId: string): Promise<InvoiceWithCharges | null> {
    if (!invoiceId) return null
    isLoading.value = true
    error.value = null
    try {
      const resp = await apiFetch<ApiSuccess<InvoiceWithCharges>>(`/api/billing/invoices/${invoiceId}`)
      detail.value = resp.data
      return resp.data
    }
    catch (err) {
      error.value = getApiErrorMessage(err, 'Không thể tải hoá đơn')
      return null
    }
    finally {
      isLoading.value = false
    }
  }

  function clear() {
    detail.value = null
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
