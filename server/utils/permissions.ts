import type { AuthUser } from '~/types/auth'
import { hasCapability } from '~/utils/constants/permissions'

export function can(user: AuthUser, capability: string): boolean {
  return hasCapability(user.app_metadata.role, capability)
}
