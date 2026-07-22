import type { BuildingService } from '~/types/building-services'
import type { ApiSuccess } from '~/types/api'
import type { BuildingServiceUpsertInput, BuildingServiceUpdateInput } from '~/utils/validators/building-services'

interface BuildingServicesSource {
  data: Readonly<Ref<BuildingService[]>>
  status: Readonly<Ref<string>>
  error: Readonly<Ref<unknown>>
  refresh: () => Promise<unknown>
}

export function useBuildingServices(buildingId: MaybeRef<string>, source?: BuildingServicesSource) {
  const fetched = source
    ? null
    : useFetch<ApiSuccess<BuildingService[]>>(
        () => `/api/building-services?building_id=${toValue(buildingId)}`,
        { watch: [() => toValue(buildingId)] },
      )

  const services = source?.data ?? computed(() => fetched?.data.value?.data ?? [])
  const status = source?.status ?? fetched!.status
  const error = source?.error ?? fetched!.error
  const refresh = source?.refresh ?? fetched!.refresh
  const isLoading = computed(() => status.value === 'pending')

  async function upsertService(input: BuildingServiceUpsertInput) {
    await apiFetch('/api/building-services', { method: 'POST', body: input })
    await refresh()
  }

  async function updateService(id: string, input: BuildingServiceUpdateInput) {
    await apiFetch(`/api/building-services/${id}`, { method: 'PATCH', body: input })
    await refresh()
  }

  async function syncToContracts(buildingId: string): Promise<number> {
    const res = await apiFetch<ApiSuccess<{ added: number }>>('/api/contract-services/sync', {
      method: 'POST',
      body: { building_id: buildingId },
    })
    return res.data.added
  }

  return { services, isLoading, error, refresh, upsertService, updateService, syncToContracts }
}
