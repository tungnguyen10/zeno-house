import type { BuildingService } from '~/types/building-services'
import type { ApiSuccess } from '~/types/api'
import type { BuildingServiceUpsertInput, BuildingServiceUpdateInput } from '~/utils/validators/building-services'

export function useBuildingServices(buildingId: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<BuildingService[]>>(
    () => `/api/building-services?building_id=${toValue(buildingId)}`,
    { watch: [() => toValue(buildingId)] },
  )

  const services = computed(() => data.value?.data ?? [])
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
