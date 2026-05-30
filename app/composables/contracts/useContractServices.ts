import type { ContractService } from '~/types/contract-services'
import type { ApiSuccess } from '~/types/api'
import type { ContractServiceUpdateInput } from '~/utils/validators/contract-services'

export function useContractServices(contractId: MaybeRef<string>) {
  const { data, status, error, refresh } = useFetch<ApiSuccess<ContractService[]>>(
    () => `/api/contract-services?contract_id=${toValue(contractId)}`,
    { watch: [() => toValue(contractId)] },
  )

  const services = computed(() => data.value?.data ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function updateService(id: string, input: ContractServiceUpdateInput) {
    await $fetch(`/api/contract-services/${id}`, { method: 'PATCH', body: input })
    await refresh()
  }

  return { services, isLoading, error, refresh, updateService }
}
