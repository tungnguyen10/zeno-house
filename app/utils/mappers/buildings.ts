import type { Tables } from '~/types/database.types'
import type { Building, BuildingStatus } from '~/types/buildings'

export function mapBuilding(row: Tables<'buildings'>): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description,
    status: row.status as BuildingStatus,
    totalRooms: row.total_rooms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
