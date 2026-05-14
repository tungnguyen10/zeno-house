import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'

export function useBuildingList() {
  const page = ref(1)
  const limit = ref(20)

  const { data, status, error, refresh } = useFetch<
    ApiSuccess<Building[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/buildings', {
    query: { page, limit },
    watch: [page, limit],
  })

  const buildings = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => status.value === 'pending')

  return {
    buildings,
    total,
    totalPages,
    page,
    limit,
    isLoading,
    error,
    refresh,
  }
}
