import type { ContractWithDetails } from '~/types/contracts'
import { useResourceDetail } from '~/composables/useResourceDetail'

export function useContractDetail(id: MaybeRef<string>) {
  const { entity, isLoading, error, refresh } = useResourceDetail<ContractWithDetails>(
    () => `/api/contracts/${toValue(id)}`,
  )

  return { contract: entity, isLoading, error, refresh }
}
