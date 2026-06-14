import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'

export function useTenantList() {
  const q = ref<string | undefined>(undefined)
  const buildingFilter = ref<string | undefined>(undefined)
  const contractStateFilter = ref<'with_contract' | 'without_contract' | '' | undefined>(undefined)
  const page = ref(1)
  const limit = 20

  // Reset page when search query changes
  watch([q, buildingFilter, contractStateFilter], () => { page.value = 1 })

  const { data, status: fetchStatus, error, refresh } = useFetch<
    ApiSuccess<Tenant[]> & { meta: { total: number; page: number; limit: number; totalPages: number } }
  >('/api/tenants', {
    query: { q, building_id: buildingFilter, contract_state: contractStateFilter, page, limit },
    watch: [q, buildingFilter, contractStateFilter, page],
  })

  const tenants = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const totalPages = computed(() => data.value?.meta?.totalPages ?? 1)
  const isLoading = computed(() => fetchStatus.value === 'pending')

  return {
    tenants,
    total,
    totalPages,
    page,
    isLoading,
    error,
    refresh,
    q,
    buildingFilter,
    contractStateFilter,
  }
}
