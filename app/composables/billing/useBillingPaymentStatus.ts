import type { BillingPaymentStatus } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

export function useBillingPaymentStatus(onSuccess?: () => void) {
  const selectedIds = ref<Set<string>>(new Set())
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  function toggle(id: string) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
    }
    else {
      selectedIds.value.add(id)
    }
  }

  function selectAll(ids: string[]) {
    ids.forEach(id => selectedIds.value.add(id))
  }

  function clearSelection() {
    selectedIds.value.clear()
  }

  async function updateStatus(status: BillingPaymentStatus, meta: {
    paid_by?: string
    payment_method?: string | null
    payment_note?: string | null
  } = {}) {
    if (selectedIds.value.size === 0) return
    isSaving.value = true
    error.value = null
    try {
      await $fetch<ApiSuccess<{ updated: number }>>('/api/billing-items/bulk-payment-status', {
        method: 'POST',
        body: {
          ids: [...selectedIds.value],
          status,
          ...meta,
        },
      })
      clearSelection()
      onSuccess?.()
    }
    catch (e: any) {
      error.value = e?.data?.error?.message ?? 'Lỗi cập nhật trạng thái thanh toán'
    }
    finally {
      isSaving.value = false
    }
  }

  async function markPaid(meta?: { paid_by?: string; payment_method?: string | null; payment_note?: string | null }) {
    await updateStatus('paid', meta)
  }

  async function markUnpaid() {
    await updateStatus('unpaid')
  }

  return {
    selectedIds: computed(() => [...selectedIds.value]),
    selectedCount: computed(() => selectedIds.value.size),
    isSaving,
    error,
    toggle,
    selectAll,
    clearSelection,
    markPaid,
    markUnpaid,
  }
}
