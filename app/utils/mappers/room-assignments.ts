import type { Tables } from '~/types/database.types'
import type { RoomAssignment } from '~/types/room-assignments'

export function mapRoomAssignment(row: Tables<'room_assignments'>): RoomAssignment {
  return {
    id: row.id,
    roomId: row.room_id,
    tenantId: row.tenant_id,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
