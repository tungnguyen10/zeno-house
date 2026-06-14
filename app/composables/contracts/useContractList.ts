import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'

export function useContractList() {
  const statusFilter = ref<string | undefined>(undefined)
  const buildingFilter = ref<string | undefined>(undefined)
  const page = ref(1)
  const limit = 20

  watch([statusFilter, buildingFilter], () => { page.value = 1 })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<ContractWithDetails[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/contracts', {
    query: { status: statusFilter, building_id: buildingFilter, page, limit },
    watch: [statusFilter, buildingFilter, page],
  })

  const contracts = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')

  return {
    contracts,
    total,
    totalPages,
    page,
    statusFilter,
    buildingFilter,
    isLoading,
    error,
    refresh,
  }
}
