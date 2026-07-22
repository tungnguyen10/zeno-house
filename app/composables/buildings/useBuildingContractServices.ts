import type { ContractService } from '~/types/contract-services'
import type { ApiSuccess } from '~/types/api'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

interface BuildingContractServicesSource {
  data: Readonly<Ref<ContractService[]>>
  status: Readonly<Ref<string>>
  error: Readonly<Ref<unknown>>
  refresh: () => Promise<unknown>
}

export function useBuildingContractServices(
  buildingId: MaybeRef<string>,
  source?: BuildingContractServicesSource,
) {
  const fetched = source
    ? null
    : useFetch<ApiSuccess<ContractService[]>>(
        () => `/api/contract-services/by-building?building_id=${toValue(buildingId)}`,
        { watch: [() => toValue(buildingId)] },
      )

  const allServices = source?.data ?? computed(() => fetched?.data.value?.data ?? [])
  const status = source?.status ?? fetched!.status
  const error = source?.error ?? fetched!.error
  const refresh = source?.refresh ?? fetched!.refresh
  const isLoading = computed(() => status.value === 'pending')

  async function updateService(id: string, input: ContractServiceUpdateInput) {
    await apiFetch(`/api/contract-services/${id}`, { method: 'PATCH', body: input })
    await refresh()
  }

  return { allServices, isLoading, error, refresh, updateService }
}
