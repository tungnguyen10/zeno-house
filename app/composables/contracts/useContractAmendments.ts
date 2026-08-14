import type { ApiSuccess } from '~/types/api'
import type { ContractAmendment } from '~/types/contract-amendments'
import type {
  ContractAmendmentCancelInput,
  ContractAmendmentCreateInput,
  ContractAmendmentPublishInput,
  ContractAmendmentUpdateInput,
} from '~/utils/validators/contract-amendments'

export function useContractAmendments(contractId: MaybeRef<string>) {
  const endpoint = computed(() => `/api/contracts/${toValue(contractId)}/amendments`)
  const { data, status, error, refresh } = useFetch<ApiSuccess<ContractAmendment[]>>(endpoint, {
    key: computed(() => `contract-amendments:${toValue(contractId)}`),
    default: () => ({ data: [] }),
  })

  const amendments = computed(() => data.value?.data ?? [])

  async function create(input: ContractAmendmentCreateInput) {
    const response = await apiFetch<ApiSuccess<ContractAmendment>>(endpoint.value, { method: 'POST', body: input })
    await refresh()
    return response.data
  }

  async function update(amendmentId: string, input: ContractAmendmentUpdateInput) {
    const response = await apiFetch<ApiSuccess<ContractAmendment>>(`${endpoint.value}/${amendmentId}`, {
      method: 'PATCH', body: input,
    })
    await refresh()
    return response.data
  }

  async function remove(amendmentId: string, expectedUpdatedAt: string) {
    await apiFetch(`${endpoint.value}/${amendmentId}`, {
      method: 'DELETE', body: { expected_updated_at: expectedUpdatedAt },
    })
    await refresh()
  }

  async function publish(amendmentId: string, input: ContractAmendmentPublishInput) {
    const response = await apiFetch<ApiSuccess<ContractAmendment>>(`${endpoint.value}/${amendmentId}/publish`, {
      method: 'POST', body: input,
    })
    await refresh()
    return response.data
  }

  async function cancel(amendmentId: string, input: ContractAmendmentCancelInput) {
    const response = await apiFetch<ApiSuccess<ContractAmendment>>(`${endpoint.value}/${amendmentId}/cancel`, {
      method: 'POST', body: input,
    })
    await refresh()
    return response.data
  }

  return { amendments, isLoading: computed(() => status.value === 'pending'), error, refresh, create, update, remove, publish, cancel }
}
