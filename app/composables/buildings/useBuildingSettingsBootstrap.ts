import type { ApiSuccess } from '~/types/api'
import type { BuildingSettingsBootstrap } from '~/types/building-settings'

export function useBuildingSettingsBootstrap(buildingIdentifier: MaybeRef<string>) {
  return useFetch<ApiSuccess<BuildingSettingsBootstrap>>(
    () => `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/settings-bootstrap`,
    {
      key: () => `building-settings:${toValue(buildingIdentifier)}`,
      watch: [() => toValue(buildingIdentifier)],
    },
  )
}
