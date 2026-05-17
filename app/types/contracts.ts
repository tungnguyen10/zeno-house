export type ContractStatus = 'active' | 'expired' | 'terminated' | 'renewed'

export interface Contract {
  id: string
  roomId: string
  tenantId: string
  buildingId: string | null
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  occupantCount: number
  discountAmount: number
  surchargeAmount: number
  previousContractId: string | null
  originalEndDate: string | null
  renewalCount: number
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
