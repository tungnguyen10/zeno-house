import type { Building } from '~/types/buildings'
import { useResourceDetail } from '~/composables/useResourceDetail'

export function useBuildingDetail(id: MaybeRef<string>) {
  const { entity, isLoading, error, refresh } = useResourceDetail<Building>(
    () => `/api/buildings/${toValue(id)}`,
  )

  return { building: entity, isLoading, error, refresh }
}
