import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingDetail(id: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<Building>>(
    () => `/api/buildings/${toValue(id)}`,
    { watch: [() => toValue(id)] },
  )

  const building = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { building, isLoading, error, refresh }
}
