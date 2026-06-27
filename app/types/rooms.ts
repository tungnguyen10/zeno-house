export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'archived'

export interface Room {
  id: string
  buildingId: string
  roomNumber: string
  slug: string
  code: string
  floor: number
  status: RoomStatus
  monthlyRent: number
  area: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}
