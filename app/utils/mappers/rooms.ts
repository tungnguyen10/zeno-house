import type { Tables } from '~/types/database.types'
import type { Room, RoomStatus } from '~/types/rooms'

export function mapRoom(row: Tables<'rooms'>): Room {
  return {
    id: row.id,
    buildingId: row.building_id,
    roomNumber: row.room_number,
    slug: row.slug,
    code: row.code,
    floor: row.floor,
    status: row.status as RoomStatus,
    monthlyRent: row.monthly_rent,
    area: row.area,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
