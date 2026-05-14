export interface RoomAssignment {
  id: string
  roomId: string
  tenantId: string
  startDate: string
  endDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface RoomAssignmentWithTenant extends RoomAssignment {
  tenant: {
    id: string
    fullName: string
    phone: string
  }
}

export interface RoomAssignmentWithRoom extends RoomAssignment {
  room: {
    id: string
    roomNumber: string
    floor: number
    buildingId: string
    buildingName: string
  }
}
