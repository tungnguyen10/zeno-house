import type { Tenant } from '~/types/tenants'
import type { ApiSuccess } from '~/types/api'

export function useTenantDetail(id: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<Tenant>>(
    () => `/api/tenants/${toValue(id)}`,
    {
      watch: [() => toValue(id)],
      getCachedData: (_key, nuxtApp) => nuxtApp.isHydrating ? nuxtApp.payload.data[_key] : undefined,
    },
  )

  const tenant = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { tenant, isLoading, error, refresh }
}
