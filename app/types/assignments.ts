import type { Database } from './database.types'

export type UserBuildingAssignment =
  Database['public']['Tables']['user_building_assignments']['Row']

export interface AssignmentBuilding {
  id: string
  slug: string
  code: string
  name: string
  address: string
  status: string
}

export interface AssignmentManager {
  id: string
  email: string | null
  name: string | null
}

export interface AssignmentWithBuilding extends UserBuildingAssignment {
  building: AssignmentBuilding | null
}

export interface ManagerAssignment {
  manager: AssignmentManager
  assignments: AssignmentWithBuilding[]
}

export interface AssignmentCreatePayload {
  user_id: string
  building_id: string
}

export interface AssignmentUpdatePayload {
  can_delete_master_data: boolean
}
