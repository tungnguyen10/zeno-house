export type TenantStatus = 'active' | 'archived'
export type TenantAssignmentRole = 'primary' | 'roommate'

export interface Tenant {
  id: string
  code: string
  fullName: string
  phone: string
  email: string | null
  idNumber: string | null
  dateOfBirth: string | null
  gender: string | null
  occupation: string | null
  idIssuedDate: string | null
  idIssuedPlace: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  permanentAddress: string | null
  notes: string | null
  status: TenantStatus
  hasActiveContract?: boolean
  activeAssignment?: {
    contractId: string
    roomId: string
    roomNumber: string
    buildingId: string
    buildingName: string
    buildingSlug: string | null
    assignmentRole: TenantAssignmentRole
    primaryTenantName: string | null
  } | null
  createdAt: string
  updatedAt: string
}
