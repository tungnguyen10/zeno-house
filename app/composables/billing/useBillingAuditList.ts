import type { ApiSuccess } from '~/types/api'
import type { BillingAuditEvent } from '~/types/billing'
import type { BillingAuditCategory } from '~/utils/constants/billing'
import { useDebounceFn } from '@vueuse/core'

export interface BillingAuditFilters {
  actorIds: string[]
  categories: BillingAuditCategory[]
  from: string
  to: string
  q: string
  correlationId: string
}

interface AuditListMeta extends Record<string, unknown> {
  total: number
  nextCursor: string | null
}

/**
 * Manages filter state, cursor pagination, and fetching for the audit drawer.
 * Backed by `GET /api/billing/periods/:id/audit` (A6 endpoint).
 */
export function useBillingAuditList(periodId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(periodId))

  const filters = reactive<BillingAuditFilters>({
    actorIds: [],
    categories: [],
    from: '',
    to: '',
    q: '',
    correlationId: '',
  })

  const events = ref<BillingAuditEvent[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const total = ref(0)
  const nextCursor = ref<string | null>(null)

  const hasMore = computed(() => !!nextCursor.value)

  function buildParams(cursor?: string | null): Record<string, string> {
    const p: Record<string, string> = {}
    if (filters.actorIds.length) p.actor = filters.actorIds.join(',')
    if (filters.categories.length) p.category = filters.categories.join(',')
    if (filters.from) p.from = filters.from
    if (filters.to) p.to = filters.to
    if (filters.q.trim()) p.q = filters.q.trim()
    if (filters.correlationId.trim()) p.correlation_id = filters.correlationId.trim()
    if (cursor) p.cursor = cursor
    return p
  }

  async function load() {
    if (!id.value) return
    loading.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingAuditEvent[], AuditListMeta>>(
        `/api/billing/periods/${id.value}/audit`,
        { params: buildParams() },
      )
      events.value = resp.data
      total.value = resp.meta?.total ?? resp.data.length
      nextCursor.value = resp.meta?.nextCursor ?? null
    }
    finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!id.value || !nextCursor.value || loadingMore.value) return
    loadingMore.value = true
    try {
      const resp = await $fetch<ApiSuccess<BillingAuditEvent[], AuditListMeta>>(
        `/api/billing/periods/${id.value}/audit`,
        { params: buildParams(nextCursor.value) },
      )
      events.value = [...events.value, ...resp.data]
      total.value = resp.meta?.total ?? events.value.length
      nextCursor.value = resp.meta?.nextCursor ?? null
    }
    finally {
      loadingMore.value = false
    }
  }

  const debouncedLoad = useDebounceFn(load, 300)

  function resetFilters() {
    filters.actorIds = []
    filters.categories = []
    filters.from = ''
    filters.to = ''
    filters.q = ''
    filters.correlationId = ''
  }

  /** Drill into a specific correlation group. */
  function filterByCorrelation(correlationId: string) {
    resetFilters()
    filters.correlationId = correlationId
    void load()
  }

  /** Reload from scratch whenever filters change (q debounced). */
  watch(() => filters.q, debouncedLoad)

  watch(
    () => [
      filters.actorIds,
      filters.categories,
      filters.from,
      filters.to,
      filters.correlationId,
    ] as const,
    () => void load(),
    { deep: true },
  )

  return {
    filters,
    events: events as Readonly<typeof events>,
    loading: loading as Readonly<typeof loading>,
    loadingMore: loadingMore as Readonly<typeof loadingMore>,
    total: total as Readonly<typeof total>,
    hasMore,
    nextCursor: nextCursor as Readonly<typeof nextCursor>,
    load,
    loadMore,
    resetFilters,
    filterByCorrelation,
  }
}
