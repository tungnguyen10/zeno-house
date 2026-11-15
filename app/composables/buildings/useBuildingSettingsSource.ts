import type { ComputedRef, InjectionKey } from 'vue'
import { computed, inject, provide } from 'vue'
import type { AssignmentManager } from '~/types/assignments'
import type { BuildingSettingsBootstrap } from '~/types/building-settings'
import type { Building } from '~/types/buildings'

type BootstrapAsyncData = Awaited<ReturnType<typeof useBuildingSettingsBootstrap>>

export interface BuildingSettingsContractRow {
  contractId: string
  roomNumber: string
  tenantName: string
}

/** Shared bootstrap data for the settings page and every step rendered under it. */
export interface BuildingSettingsSource {
  id: string
  settingsData: BootstrapAsyncData['data']
  status: BootstrapAsyncData['status']
  error: BootstrapAsyncData['error']
  refresh: BootstrapAsyncData['refresh']
  settings: ComputedRef<BuildingSettingsBootstrap | null>
  building: ComputedRef<Building | null>
  contractRows: ComputedRef<BuildingSettingsContractRow[]>
  assignedManagers: ComputedRef<AssignmentManager[]>
}

const SOURCE_KEY: InjectionKey<BuildingSettingsSource> = Symbol('building-settings-source')

export function createBuildingSettingsSource(id: string, asyncData: BootstrapAsyncData): BuildingSettingsSource {
  const settings = computed(() => asyncData.data.value?.data ?? null)
  return {
    id,
    settingsData: asyncData.data,
    status: asyncData.status,
    error: asyncData.error,
    refresh: asyncData.refresh,
    settings,
    building: computed(() => settings.value?.building ?? null),
    contractRows: computed(() =>
      (settings.value?.contracts ?? []).map(contract => ({
        contractId: contract.id,
        roomNumber: contract.room.roomNumber,
        tenantName: contract.tenant.fullName,
      })),
    ),
    assignedManagers: computed(() => settings.value?.managers ?? []),
  }
}

export function provideBuildingSettingsSource(source: BuildingSettingsSource) {
  provide(SOURCE_KEY, source)
}

export function useBuildingSettingsSource(): BuildingSettingsSource {
  const source = inject(SOURCE_KEY, null)
  if (!source) throw new Error('useBuildingSettingsSource needs an ancestor that calls provideBuildingSettingsSource')
  return source
}
