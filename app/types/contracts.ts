export type ContractStatus = 'active' | 'expired' | 'terminated'

export interface Contract {
  id: string
  roomId: string
  tenantId: string
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  status: ContractStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ContractWithDetails extends Contract {
  room: {
    id: string
    roomNumber: string
    floor: number
    buildingName: string
  }
  tenant: {
    id: string
    fullName: string
    phone: string
  }
}
