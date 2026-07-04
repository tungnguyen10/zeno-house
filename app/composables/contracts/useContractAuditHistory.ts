import type { ApiSuccess } from '~/types/api'
import type { AuditEvent } from '~/types/audit'

export function useContractAuditHistory(
  contractId: MaybeRefOrGetter<string>,
  buildingId: MaybeRefOrGetter<string>,
  limit: MaybeRefOrGetter<number> = 50,
) {
  const query = computed(() => ({
    building_id: toValue(buildingId),
    entity_type: 'contract',
    entity_id: toValue(contractId),
    limit: toValue(limit),
  }))

  const { data, status, error, refresh } = useFetch<ApiSuccess<AuditEvent[]> & { meta: { total: number } }>(
    '/api/audit',
    {
      query,
      watch: [query],
    },
  )

  const events = computed(() => data.value?.data ?? [])
  const total = computed(() => data.value?.meta?.total ?? 0)
  const isLoading = computed(() => status.value === 'pending')

  return { events, total, isLoading, error, refresh }
}
