import type { ApiSuccess } from '~/types/api'
import type { AccessRequest } from '~/types/access-requests'

export const ACCESS_REQUEST_PENDING_COUNT_KEY = 'access-requests:pending-count'

/** Pending access-request count for the Settings nav badge; `null` when unavailable. */
export function useAccessRequestPendingCount(enabled: MaybeRefOrGetter<boolean>) {
  const { data, error } = useLazyFetch<ApiSuccess<AccessRequest[]>>('/api/access-requests', {
    key: ACCESS_REQUEST_PENDING_COUNT_KEY,
    query: { status: 'pending' },
    server: false,
    immediate: toValue(enabled),
  })

  return computed(() => (toValue(enabled) && !error.value && data.value ? data.value.data.length : null))
}
