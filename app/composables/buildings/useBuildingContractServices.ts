import type { ContractService } from '~/types/contract-services'
import type { ApiSuccess } from '~/types/api'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

export function useBuildingContractServices(buildingId: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<ContractService[]>>(
    () => `/api/contract-services/by-building?building_id=${toValue(buildingId)}`,
    { watch: [() => toValue(buildingId)] },
  )

  const allServices = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function updateService(id: string, input: ContractServiceUpdateInput) {
    await apiFetch(`/api/contract-services/${id}`, { method: 'PATCH', body: input })
    await refresh()
  }

  return { allServices, isLoading, error, refresh, updateService }
}
