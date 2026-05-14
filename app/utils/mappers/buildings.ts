import type { Tables } from '~/types/database.types'
import type { Building, BuildingStatus } from '~/types/buildings'

export type BuildingRow = Tables<'buildings'> & { rooms: [{ count: number }] }

export function mapBuilding(row: BuildingRow): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description,
    status: row.status as BuildingStatus,
    totalRooms: row.rooms[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
