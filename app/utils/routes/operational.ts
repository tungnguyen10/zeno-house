import { slugifyName } from '~/utils/format/slug'

export interface BuildingRouteSubject {
  id: string
  slug?: string | null
  name?: string | null
}

export interface RoomRouteSubject {
  id: string
  roomNumber?: string | null
  slug?: string | null
  building?: BuildingRouteSubject | null
}

export interface ContractRouteSubject {
  id: string
  code?: string | null
  contractCode?: string | null
  slug?: string | null
}

export function buildingRouteSegment(building: BuildingRouteSubject): string {
  return building.slug || (building.name ? slugifyName(building.name) : building.id)
}

export function buildingPath(building: BuildingRouteSubject): string {
  return `/buildings/${buildingRouteSegment(building)}`
}

export function buildingEditPath(building: BuildingRouteSubject): string {
  return `${buildingPath(building)}/edit`
}

export function buildingSettingsPath(building: BuildingRouteSubject): string {
  return `${buildingPath(building)}/settings`
}

export function roomRouteSegment(room: RoomRouteSubject): string {
  return room.slug || (room.roomNumber ? slugifyName(room.roomNumber) : room.id)
}

export function roomPath(room: RoomRouteSubject): string {
  if (room.building) {
    return `${buildingPath(room.building)}/rooms/${roomRouteSegment(room)}`
  }
  return `/rooms/${room.id}`
}

export function billingWorkspacePath(
  building: BuildingRouteSubject,
  periodYear: number,
  periodMonth: number,
): string {
  return `/billing/${buildingRouteSegment(building)}/${periodYear}-${String(periodMonth).padStart(2, '0')}`
}

export function contractPath(contract: ContractRouteSubject): string {
  return `/contracts/${contract.slug || contract.contractCode || contract.code || contract.id}`
}

export function tenantPath(id: string): string {
  return `/tenants/${id}`
}
