import type { ApiSuccess } from '~/types/api'
import type { TenantContractSummary } from '~/types/tenant-portal'

/** Active contract summary for the signed-in tenant. */
export function usePortalContract() {
  const { data, status, error, refresh } = useFetch<ApiSuccess<TenantContractSummary | null>>(
    '/api/tenant/contract',
    { key: 'portal-contract' },
  )

  const contract = computed(() => data.value?.data ?? null)

  return { contract, status, error, refresh }
}
