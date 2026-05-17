import type { ContractOccupant } from '~/types/contract-occupants'
import type { ContractOccupantAddInput, ContractOccupantMoveOutInput } from '~/utils/validators/contract-occupants'
import type { ApiSuccess } from '~/types/api'

export function useContractOccupants(contractId: MaybeRef<string>) {
  const occupants = ref<ContractOccupant[]>([])
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function fetchOccupants() {
    isLoading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiSuccess<ContractOccupant[]>>(
        `/api/contracts/${toValue(contractId)}/occupants`,
      )
      occupants.value = res.data
    } catch (e) {
      error.value = e as Error
    } finally {
      isLoading.value = false
    }
  }

  async function addOccupant(input: ContractOccupantAddInput): Promise<ContractOccupant> {
    const res = await $fetch<ApiSuccess<ContractOccupant>>(
      `/api/contracts/${toValue(contractId)}/occupants`,
      { method: 'POST', body: input },
    )
    occupants.value = [...occupants.value, res.data]
    return res.data
  }

  async function moveOut(occupantId: string, input: ContractOccupantMoveOutInput): Promise<void> {
    const res = await $fetch<ApiSuccess<ContractOccupant>>(
      `/api/contracts/${toValue(contractId)}/occupants/${occupantId}`,
      { method: 'PATCH', body: input },
    )
    const idx = occupants.value.findIndex(o => o.id === occupantId)
    if (idx !== -1) occupants.value[idx] = res.data
  }

  async function removeOccupant(occupantId: string): Promise<void> {
    await $fetch(
      `/api/contracts/${toValue(contractId)}/occupants/${occupantId}`,
      { method: 'DELETE' },
    )
    occupants.value = occupants.value.filter(o => o.id !== occupantId)
  }

  fetchOccupants()

  return {
    occupants,
    isLoading,
    error,
    addOccupant,
    moveOut,
    removeOccupant,
    refresh: fetchOccupants,
  }
}
