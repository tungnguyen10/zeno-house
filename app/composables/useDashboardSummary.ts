import type { DashboardSummary } from '~/types/dashboard'
import type { ApiSuccess } from '~/types/api'

export function useDashboardSummary() {
  const { data, status, error } = useFetch<ApiSuccess<DashboardSummary>>('/api/dashboard/summary')

  const summary = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { summary, isLoading, error }
}
