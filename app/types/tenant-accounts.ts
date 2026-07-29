export type TenantAccountStatus = 'active' | 'disabled'
export type TenantAccountHealth = 'none' | 'linked' | 'missing_auth' | 'orphaned'
export type TenantAccountRemovalOutcome = 'deleted' | 'deactivated'

/** Whether a tenant record has a portal login, and its current link state. */
export interface TenantAccountState {
  tenantId: string
  hasAccount: boolean
  email: string | null
  status: TenantAccountStatus | null
  linkedAt: string | null
  health: Exclude<TenantAccountHealth, 'orphaned'>
}

/** One-time credentials returned by provision/reset — never persisted or re-fetched. */
export interface TenantAccountCredentials {
  email: string
  tempPassword: string
}

/** A provisioned tenant account row for the Settings management list. */
export interface TenantAccountListItem {
  authUserId: string
  tenantId: string
  tenantCode: string
  tenantName: string
  email: string | null
  status: TenantAccountStatus
  linkedAt: string
  health: Extract<TenantAccountHealth, 'linked' | 'missing_auth'>
}

/** Tenant-role Auth identity with no tenant link. Visible to admins only. */
export interface TenantAccountOrphan {
  authUserId: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  health: 'orphaned'
}

export interface TenantAccountRemovalResult {
  outcome: TenantAccountRemovalOutcome
}
