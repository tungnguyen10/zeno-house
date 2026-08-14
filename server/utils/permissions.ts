import type { AuthUser } from '~/types/auth'
import { hasCapability } from '~/utils/constants/permissions'

export function can(user: AuthUser, capability: string): boolean {
  return hasCapability(user.app_metadata.role, capability)
}

/** Asserts the user holds a capability, throwing 403 with an optional message otherwise. */
export function requireCapability(user: AuthUser, capability: string, message?: string): void {
  if (!can(user, capability)) throwForbidden(message)
}
