import type { BillingWorkspaceData } from '~/types/billing'
import type { ApiSuccess } from '~/types/api'

export function useBillingWorkspace(
  buildingId: MaybeRef<string>,
  year: MaybeRef<number>,
  month: MaybeRef<number>,
) {
  const { data, status, refresh } = useFetch<ApiSuccess<BillingWorkspaceData>>(
    () =>
      `/api/billing-runs/workspace?building_id=${toValue(buildingId)}&year=${toValue(year)}&month=${toValue(month)}`,
    {
      watch: [() => toValue(buildingId), () => toValue(year), () => toValue(month)],
    },
  )

  const workspaceData = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { workspaceData, isLoading, status, refresh }
}
