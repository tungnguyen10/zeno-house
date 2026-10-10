import type { ApiSuccess } from '~/types/api'

/** Fetches a single resource DTO from an endpoint, re-fetching when the endpoint changes. */
export function useResourceDetail<T>(endpoint: MaybeRefOrGetter<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<T>>(
    () => toValue(endpoint),
    {
      watch: [() => toValue(endpoint)],
      getCachedData: (key, nuxtApp) => (nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined),
    },
  )

  const entity = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'idle' || status.value === 'pending')

  return { entity, data, status, isLoading, error, refresh }
}
