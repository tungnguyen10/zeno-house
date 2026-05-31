import type { BillingItemDetail } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

export function useBillingItemDetail() {
  const detailCache = ref<Map<string, BillingItemDetail>>(new Map())
  const loadingIds = ref<Set<string>>(new Set())
  const detail = ref<BillingItemDetail | null>(null)
  const isLoading = ref(false)

  async function loadDetail(itemId: string) {
    if (detailCache.value.has(itemId)) {
      detail.value = detailCache.value.get(itemId)!
      return
    }
    isLoading.value = true
    loadingIds.value.add(itemId)
    try {
      const res = await $fetch<ApiSuccess<BillingItemDetail>>(`/api/billing-items/${itemId}/detail`)
      detailCache.value.set(itemId, res.data)
      detail.value = res.data
    }
    finally {
      isLoading.value = false
      loadingIds.value.delete(itemId)
    }
  }

  function isItemLoading(itemId: string) {
    return loadingIds.value.has(itemId)
  }

  function clearCache() {
    detailCache.value.clear()
    detail.value = null
  }

  return { detail, isLoading, loadDetail, isItemLoading, clearCache }
}
