import type { ContractRenewal } from '~/types/contract-renewals'
import type { ContractRenewInput } from '~/utils/validators/contract-renewals'
import type { ApiSuccess } from '~/types/api'

export function useContractRenewals(contractId: MaybeRef<string>) {
  const renewals = ref<ContractRenewal[]>([])
  // Starts true so SSR renders the same skeleton the client hydrates with.
  const isLoading = ref(true)
  const error = ref<Error | null>(null)

  async function fetchRenewals() {
    isLoading.value = true
    error.value = null
    try {
      const res = await apiFetch<ApiSuccess<ContractRenewal[]>>(
        `/api/contracts/${toValue(contractId)}/renewals`,
      )
      renewals.value = res.data
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function renew(input: ContractRenewInput): Promise<ContractRenewal> {
    const res = await apiFetch<ApiSuccess<ContractRenewal>>(
      `/api/contracts/${toValue(contractId)}/renew`,
      { method: 'POST', body: input },
    )
    renewals.value = [res.data, ...renewals.value]
    return res.data
  }

  // Client-only: this result is not transferred in the SSR payload, so fetching on the
  // server just renders state the client immediately contradicts on hydration.
  if (import.meta.client) fetchRenewals()

  return { renewals, isLoading, error, renew, refresh: fetchRenewals }
}
