import type { BillingPeriod } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

export function useBillingPeriod(buildingId: MaybeRef<string>, year: MaybeRef<number>, month: MaybeRef<number>) {
  const period = ref<BillingPeriod | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiSuccess<BillingPeriod>>('/api/billing-periods', {
        method: 'POST',
        body: {
          building_id: toValue(buildingId),
          year: toValue(year),
          month: toValue(month),
        },
      })
      period.value = res.data
    }
    catch (e: any) {
      error.value = e?.data?.error?.message ?? 'Lỗi tải chu kỳ thanh toán'
    }
    finally {
      isLoading.value = false
    }
  }

  async function finalize() {
    if (!period.value) return
    isSaving.value = true
    error.value = null
    try {
      const res = await $fetch<ApiSuccess<BillingPeriod>>(`/api/billing-periods/${period.value.id}`, {
        method: 'PATCH',
        body: { action: 'finalize' },
      })
      period.value = res.data
    }
    catch (e: any) {
      error.value = e?.data?.error?.message ?? 'Lỗi khóa chu kỳ'
    }
    finally {
      isSaving.value = false
    }
  }

  async function unlock() {
    if (!period.value) return
    isSaving.value = true
    error.value = null
    try {
      const res = await $fetch<ApiSuccess<BillingPeriod>>(`/api/billing-periods/${period.value.id}`, {
        method: 'PATCH',
        body: { action: 'unlock' },
      })
      period.value = res.data
    }
    catch (e: any) {
      error.value = e?.data?.error?.message ?? 'Lỗi mở khóa chu kỳ'
    }
    finally {
      isSaving.value = false
    }
  }

  function syncPeriod(p: BillingPeriod) {
    period.value = p
  }

  return { period, isLoading, isSaving, error, load, finalize, unlock, syncPeriod }
}
