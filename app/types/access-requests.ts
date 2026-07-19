import type { UserRole } from '~/utils/constants/roles'

export type AccessRequestStatus = 'pending' | 'processing' | 'approved' | 'rejected'
export type AccessRequestProvider = 'email' | 'google' | string
export type ApprovableRole = Exclude<UserRole, 'admin'>

export interface AccessRequest {
  id: string
  authUserId: string
  email: string
  fullName: string | null
  provider: AccessRequestProvider
  status: AccessRequestStatus
  emailVerified: boolean
  decisionRole: ApprovableRole | null
  decisionBuildingIds: string[]
  decisionTenantId: string | null
  rejectionReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  approvalClaimToken: string | null
  createdAt: string
  updatedAt: string
}

export interface CurrentAccessRequest {
  status: AccessRequestStatus
  email: string
  rejectionReason: string | null
  decisionRole: ApprovableRole | null
}
