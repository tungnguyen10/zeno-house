import type { Tenant } from '~/types/tenants'
import { useResourceDetail } from '~/composables/useResourceDetail'

export function useTenantDetail(id: MaybeRef<string>) {
  const { entity, isLoading, error, refresh } = useResourceDetail<Tenant>(
    () => `/api/tenants/${toValue(id)}`,
  )

  return { tenant: entity, isLoading, error, refresh }
}
