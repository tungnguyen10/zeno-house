import type { AuthUser } from '~/types/auth'
import { ROLES } from '~/utils/constants/roles'
import type { UserRole } from '~/utils/constants/roles'

/**
 * Read the authorization role from `app_metadata.role` only.
 *
 * Authorization MUST NOT rely on a top-level `user.role` (that is the Postgres
 * `authenticated` role from JWT claims) or `user_metadata` (user-editable).
 */
export function roleOf(user: AuthUser): UserRole | null {
  return user.app_metadata?.role ?? null
}

export function isAdmin(user: AuthUser): boolean {
  return roleOf(user) === ROLES.ADMIN
}

export function isOwner(user: AuthUser): boolean {
  return roleOf(user) === ROLES.OWNER
}

export function isManager(user: AuthUser): boolean {
  return roleOf(user) === ROLES.MANAGER
}

export function isTenant(user: AuthUser): boolean {
  return roleOf(user) === ROLES.TENANT
}

/** True for roles whose access is limited to assigned buildings (owner, manager). */
export function isScopedRole(user: AuthUser): boolean {
  const role = roleOf(user)
  return role === ROLES.OWNER || role === ROLES.MANAGER
}
