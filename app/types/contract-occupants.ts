export interface ContractOccupant {
  id: string
  contractId: string
  tenantId: string
  tenantName: string | null
  tenantPhone: string | null
  role: 'primary' | 'roommate'
  moveInDate: string
  moveOutDate: string | null
  billingCounted: boolean
  createdAt: string
  updatedAt: string
}
