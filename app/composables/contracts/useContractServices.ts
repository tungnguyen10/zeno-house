import type { ContractService } from '~/types/contract-services'
import type { ApiSuccess } from '~/types/api'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

export function useContractServices(contractId: MaybeRef<string>) {
  const url = computed(() => `/api/contract-services?contract_id=${toValue(contractId)}`)

  const { data, status, error, refresh } = useFetch<ApiSuccess<ContractService[]>>(url, {
    immediate: false,
    watch: false,
  })

  watch(() => toValue(contractId), (value) => {
    if (value) refresh()
  }, { immediate: true })

  const services = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function updateService(id: string, input: ContractServiceUpdateInput) {
    await apiFetch(`/api/contract-services/${id}`, { method: 'PATCH', body: input })
    await refresh()
  }

  async function removeService(id: string, reason: string) {
    await apiFetch(`/api/contract-services/${id}`, { method: 'DELETE', body: { reason } })
    await refresh()
  }

  return { services, isLoading, error, refresh, updateService, removeService }
}
