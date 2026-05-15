export interface BuildingRoomStats {
  total: number
  available: number
  occupied: number
  maintenance: number
}

export interface DashboardSummary {
  buildings: { total: number }
  rooms: BuildingRoomStats
  tenants: { total: number }
  contracts: { active: number }
  buildingBreakdown: Array<{
    id: string
    name: string
    rooms: BuildingRoomStats
  }>
}
