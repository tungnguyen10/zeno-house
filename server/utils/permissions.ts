import type { AuthUser } from '~/types/auth'
import type { UserRole } from '~/utils/constants/roles'

const PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set([
    'buildings.read',
    'buildings.create',
    'buildings.update',
    'buildings.delete',
    'rooms.read',
    'rooms.create',
    'rooms.update',
    'rooms.delete',
    'tenants.read',
    'tenants.create',
    'tenants.update',
    'tenants.delete',
    'contracts.read',
    'contracts.create',
    'contracts.update',
    'contracts.delete',
  ]),
  manager: new Set([
    'buildings.read',
    'rooms.read',
    'rooms.update',
    'tenants.read',
    'contracts.read',
  ]),
}

export function can(user: AuthUser, capability: string): boolean {
  const role = user.app_metadata.role
  if (!role) return false
  return PERMISSIONS[role]?.has(capability) ?? false
}
