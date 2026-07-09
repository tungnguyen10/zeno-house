import type { DashboardSummaryResponse } from '~/types/dashboard'
import type { ApiErrorLike } from '~/utils/api-error'

const GENERIC_ERROR = 'Không tải được dữ liệu dashboard. Vui lòng thử lại.'

export function useDashboardSummary() {
  const { data, status, error, refresh } = useFetch<DashboardSummaryResponse>(
    '/api/dashboard/summary',
  )

  const summary = computed(() => data.value?.data ?? null)
  const meta = computed(() => data.value?.meta ?? null)
  const isLoading = computed(() => status.value === 'pending')

  const errorBody = computed(() => {
    const raw = error.value
    if (!raw) return null
    const body = (raw as ApiErrorLike).data
    return body?.error ?? null
  })

  const errorMessage = computed<string | null>(() => {
    if (!error.value) return null
    return errorBody.value?.message ?? GENERIC_ERROR
  })

  const errorCode = computed<string | null>(() => {
    if (!error.value) return null
    return errorBody.value?.code ?? null
  })

  return {
    summary,
    meta,
    isLoading,
    error: errorMessage,
    errorCode,
    refresh,
  }
}
