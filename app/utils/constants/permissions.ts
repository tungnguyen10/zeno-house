import { ROLES } from '~/utils/constants/roles'
import type { UserRole } from '~/utils/constants/roles'

/**
 * Capabilities granted to the owner role. Owner has full CRUD over domain
 * content within its assigned scope (the server enforces the building scope).
 */
export const OWNER_CAPABILITIES = [
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
  'meter-readings.read',
  'meter-readings.write',
  'building-services.read',
  'building-services.write',
  'contract-services.read',
  'contract-services.write',
  'billing.read',
  'billing.write',
  'billing.corrections',
  'billing.close',
  'dashboard.read',
  // Operations report: report read + expense/fixed-cost management.
  'operations-report.read',
  'operations-report.export',
  'building-expenses.read',
  'building-expenses.write',
  'building-expenses.delete',
  'building-fixed-costs.read',
  'building-fixed-costs.write',
  'recurring-expenses.read',
  'recurring-expenses.write',
  'recurring-expenses.delete',
  'prepaid-expenses.read',
  'prepaid-expenses.write',
  'shared-expenses.read',
  'shared-expenses.write',
  'shared-expenses.allocate',
  'reserve-fund.read',
  'reserve-fund.manage',
  // Scoped user management: owner can manage managers inside owner scope.
  'users.manage.scoped',
  'users.create.manager',
] as const

export const ADMIN_ONLY_CAPABILITIES = [
  'operations-report.close',
  'operations-report.reopen',
  'reserve-fund.refresh-accrual',
] as const

/**
 * Single source of truth for role capabilities, shared by the client (UI
 * visibility) and the server (authorization). The server remains authoritative;
 * the client uses this only to decide which controls to render.
 */
export const ROLE_CAPABILITIES: Record<UserRole, readonly string[]> = {
  [ROLES.ADMIN]: [
    ...OWNER_CAPABILITIES,
    ...ADMIN_ONLY_CAPABILITIES,
    'billing.reopen',
    'billing.unissue',
    // Global user management: admin sees/manages everyone.
    'users.manage.global',
    'users.create.owner',
    // Note: `users.create.admin` is intentionally granted to NO role.
    // Admin accounts are bootstrapped outside the app.
  ],
  [ROLES.OWNER]: OWNER_CAPABILITIES,
  [ROLES.MANAGER]: [
    'buildings.read',
    'rooms.read',
    'rooms.update',
    'tenants.read',
    'contracts.read',
    'meter-readings.read',
    'meter-readings.write',
    'building-services.read',
    'building-services.write',
    'contract-services.read',
    'contract-services.write',
    'billing.read',
    'billing.write',
    'billing.corrections',
    'dashboard.read',
    // Operations report: manager may read reports and create/edit expenses in
    // scope, but not void expenses or configure fixed costs.
    'operations-report.read',
    'building-expenses.read',
    'building-expenses.write',
    'recurring-expenses.read',
  ],
}

export type Capability =
  | (typeof OWNER_CAPABILITIES)[number]
  | (typeof ADMIN_ONLY_CAPABILITIES)[number]

const CAPABILITY_SETS: Record<UserRole, Set<string>> = {
  [ROLES.ADMIN]: new Set(ROLE_CAPABILITIES[ROLES.ADMIN]),
  [ROLES.OWNER]: new Set(ROLE_CAPABILITIES[ROLES.OWNER]),
  [ROLES.MANAGER]: new Set(ROLE_CAPABILITIES[ROLES.MANAGER]),
}

/** Returns true when the given role is granted the capability. */
export function hasCapability(role: UserRole | null | undefined, capability: string): boolean {
  if (!role) return false
  return CAPABILITY_SETS[role]?.has(capability) ?? false
}
