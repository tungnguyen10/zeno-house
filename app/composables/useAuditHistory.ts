import type { AuditEvent } from '~/types/audit'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { AuditEntityType } from '~/utils/constants/audit'

export function useAuditHistory() {
  const buildingId = ref<string>('')
  const entityType = ref<AuditEntityType | ''>('')
  const limit = ref(50)

  const { data: buildingsData } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
    '/api/buildings',
    { query: { limit: 100, sort: 'name', order: 'asc' } },
  )
  const buildings = computed(() => buildingsData.value?.data ?? [])

  const query = computed(() => ({
    building_id: buildingId.value || undefined,
    entity_type: entityType.value || undefined,
    limit: limit.value,
  }))

  const {
    data,
    status,
    refresh,
    error,
  } = useFetch<ApiSuccess<AuditEvent[]> & { meta: { total: number } }>('/api/audit', {
    query,
    watch: [buildingId, entityType, limit],
  })

  const events = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const isLoading = computed(() => status.value === 'pending')

  return {
    buildingId,
    entityType,
    limit,
    buildings,
    events,
    total,
    isLoading,
    error,
    refresh,
  }
}
