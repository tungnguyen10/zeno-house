import type { UserRole } from '~/utils/constants/roles'
import type { AssignmentWithBuilding } from './assignments'

/** Non-sensitive representation of a managed auth user (owner or manager). */
export interface ManagedUser {
  id: string
  email: string | null
  name: string | null
  role: UserRole
  createdBy: string | null
}

/** A managed user together with their building assignments (scoped for owner). */
export interface ManagedUserWithAssignments {
  user: ManagedUser
  assignments: AssignmentWithBuilding[]
}
