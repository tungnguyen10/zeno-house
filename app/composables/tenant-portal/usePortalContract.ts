import { usePortalBootstrap } from './usePortalBootstrap'

/** Active contract summary for the signed-in tenant. */
export function usePortalContract() {
  const { data, status, error, refresh } = usePortalBootstrap()

  const contract = computed(() => data.value?.data.contract ?? null)
  const contractAmendments = computed(() => data.value?.data.contractAmendments ?? [])

  return { contract, contractAmendments, status, error, refresh }
}
