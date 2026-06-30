import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingDetail(id: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<Building>>(
    () => `/api/buildings/${toValue(id)}`,
    {
      watch: [() => toValue(id)],
      getCachedData: (_key, nuxtApp) => nuxtApp.isHydrating ? nuxtApp.payload.data[_key] : undefined,
    },
  )

  const building = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { building, isLoading, error, refresh }
}
