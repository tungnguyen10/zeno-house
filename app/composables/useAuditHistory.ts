import type { AuditEvent } from '~/types/audit'
import type { Building } from '~/types/buildings'
import type { ApiSuccess } from '~/types/api'
import type { AuditEntityType } from '~/utils/constants/audit'

export function useAuditHistory() {
  const buildingId = ref<string>('')
  const entityType = ref<AuditEntityType | ''>('')
  const limit = 50

  const { data: buildingsData } = useFetch<ApiSuccess<Building[]> & { meta: { total: number } }>(
    '/api/buildings',
    { query: { limit: 100, sort: 'name', order: 'asc' } },
  )
  const buildings = computed(() => buildingsData.value?.data ?? [])

  const query = computed(() => ({
    building_id: buildingId.value || undefined,
    entity_type: entityType.value || undefined,
    limit,
  }))

  const {
    data,
    status,
    refresh,
    error,
  } = useFetch<ApiSuccess<AuditEvent[]> & { meta: { total: number, nextCursor: string | null } }>('/api/audit', {
    query,
    watch: [buildingId, entityType],
  })

  const events = ref<AuditEvent[]>([])
  const nextCursor = ref<string | null>(null)
  const isLoadingMore = ref(false)
  watch(data, (response) => {
    events.value = response?.data ?? []
    nextCursor.value = response?.meta?.nextCursor ?? null
  }, { immediate: true })
  const total = computed(() => data.value?.meta?.total ?? 0)
  const isLoading = computed(() => status.value === 'pending')
  const hasMore = computed(() => Boolean(nextCursor.value))

  async function loadMore(): Promise<void> {
    if (!nextCursor.value || isLoadingMore.value) return
    isLoadingMore.value = true
    const requestedCursor = nextCursor.value
    const requestedBuildingId = buildingId.value
    const requestedEntityType = entityType.value
    try {
      const response = await apiFetch<ApiSuccess<AuditEvent[]> & { meta: { total: number, nextCursor: string | null } }>(
        '/api/audit',
        {
          params: {
            building_id: buildingId.value || undefined,
            entity_type: entityType.value || undefined,
            limit,
            cursor: requestedCursor,
          },
        },
      )
      if (
        buildingId.value !== requestedBuildingId
        || entityType.value !== requestedEntityType
        || nextCursor.value !== requestedCursor
      ) return
      const existingIds = new Set(events.value.map(event => event.id))
      events.value = [...events.value, ...response.data.filter(event => !existingIds.has(event.id))]
      nextCursor.value = response.meta?.nextCursor ?? null
    }
    finally {
      isLoadingMore.value = false
    }
  }

  return {
    buildingId,
    entityType,
    buildings,
    events,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    refresh,
  }
}
