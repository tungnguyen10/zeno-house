import type { ContractWithDetails } from '~/types/contracts'
import type { ApiSuccess } from '~/types/api'

export function useContractDetail(id: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<ContractWithDetails>>(
    () => `/api/contracts/${toValue(id)}`,
    {
      watch: [() => toValue(id)],
      getCachedData: (_key, nuxtApp) => nuxtApp.isHydrating ? nuxtApp.payload.data[_key] : undefined,
    },
  )

  const contract = computed(() => data.value?.data ?? null)
  const isLoading = computed(() => status.value === 'pending')

  return { contract, isLoading, error, refresh }
}
