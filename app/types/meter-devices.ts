export type MeterType = 'electricity' | 'water'
export type MeterStatus = 'active' | 'replaced' | 'broken' | 'inactive'

export interface MeterDevice {
  id: string
  buildingId: string
  roomId: string
  meterType: MeterType
  meterCode: string | null
  startReading: number
  endReading: number | null
  installedAt: string
  removedAt: string | null
  status: MeterStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ContractOccupant {
  id: string
  contractId: string
  tenantId: string
  role: 'primary' | 'roommate'
  moveInDate: string
  moveOutDate: string | null
  billingCounted: boolean
  createdAt: string
  updatedAt: string
}
