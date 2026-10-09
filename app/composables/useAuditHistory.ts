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

  // Derived, not copied via a watcher: watchers do not flush before the server render,
  // so SSR showed an empty list next to a non-zero total and mismatched on hydration.
  const appended = ref<AuditEvent[]>([])
  const appendedCursor = ref<string | null | undefined>(undefined)
  const isLoadingMore = ref(false)

  const events = computed(() => [...(data.value?.data ?? []), ...appended.value])
  const nextCursor = computed(() =>
    appendedCursor.value === undefined ? (data.value?.meta?.nextCursor ?? null) : appendedCursor.value,
  )
  watch(data, () => {
    appended.value = []
    appendedCursor.value = undefined
  })
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
      appended.value = [...appended.value, ...response.data.filter(event => !existingIds.has(event.id))]
      appendedCursor.value = response.meta?.nextCursor ?? null
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
