export type BuildingStatus = 'active' | 'inactive'

export interface Building {
  id: string
  name: string
  address: string
  description: string | null
  status: BuildingStatus
  totalRooms: number
  createdAt: string
  updatedAt: string
}

export interface BuildingInput {
  name: string
  address: string
  description?: string | null
  status?: BuildingStatus
}

export type BuildingUpdateInput = Partial<BuildingInput>
