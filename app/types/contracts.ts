export type ContractStatus = 'active' | 'expired' | 'terminated' | 'renewed'

export interface Contract {
  id: string
  contractCode: string
  roomId: string
  tenantId: string
  buildingId: string
  startDate: string
  endDate: string
  monthlyRent: number
  deposit: number
  paymentDay: number | null
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
    buildingId: string
    buildingName: string
  }
  tenant: {
    id: string
    fullName: string
    phone: string
  }
}
